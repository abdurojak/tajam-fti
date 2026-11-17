import { it, expect } from "vitest";
import { databaseTunnel } from "../src/lib/database-tunnel";
import { Pool } from "pg";

it.skipIf(!process.env.DB_SSH_HOST)("reads the server database through the restricted SSH tunnel", async () => {
  const port = await databaseTunnel();
  const url = new URL(process.env.DATABASE_URL!);
  url.hostname = "127.0.0.1";
  url.port = String(port);
  const pool = new Pool({ connectionString: url.toString(), connectionTimeoutMillis: 10000 });
  try {
    const result = await pool.query("select current_user, (select count(*) from content) as count");
    expect(result.rows[0].current_user).toBe("tajam_netlify");
    expect(Number(result.rows[0].count)).toBeGreaterThan(0);
  } finally { await pool.end(); }
}, 30000);
