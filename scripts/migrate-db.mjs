import { readFile } from "node:fs/promises";
import pg from "pg";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) {
  console.error(
    "Isi DATABASE_URL di .env.local atau environment sebelum migrasi.",
  );
  process.exit(1);
}
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(74201919)");
  await client.query(
    await readFile(new URL("../db/001-content.sql", import.meta.url), "utf8"),
  );
  await client.query("COMMIT");
  console.log("Skema TAJAM FTI siap. Data yang sudah ada dipertahankan.");
} catch {
  await client.query("ROLLBACK").catch(() => {});
  console.error(
    "Migrasi gagal. Periksa koneksi, izin database, dan konfigurasi TLS. Kredensial tidak dicetak.",
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
