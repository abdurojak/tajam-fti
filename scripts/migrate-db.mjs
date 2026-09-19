import { readdir, readFile } from "node:fs/promises";
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
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const directory = new URL("../db/", import.meta.url);
  const files = (await readdir(directory))
    .filter((name) => /^\d{3}-.*\.sql$/.test(name))
    .sort();
  for (const file of files) {
    const applied = await client.query(
      "SELECT 1 FROM schema_migrations WHERE version=$1",
      [file],
    );
    if (applied.rowCount) continue;
    await client.query("BEGIN");
    try {
      await client.query("SELECT pg_advisory_xact_lock(74201919)");
      await client.query(await readFile(new URL(file, directory), "utf8"));
      await client.query(
        "INSERT INTO schema_migrations(version) VALUES ($1) ON CONFLICT DO NOTHING",
        [file],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
  console.log("Skema TAJAM FTI siap. Data yang sudah ada dipertahankan.");
} catch {
  console.error(
    "Migrasi gagal. Periksa koneksi, izin database, dan konfigurasi TLS. Kredensial tidak dicetak.",
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
