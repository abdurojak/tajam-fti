import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import {
  fingerprint,
  validateContent,
  type Content,
  type ContentInput,
} from "./domain";

type Row = {
  id: string;
  payload: ContentInput;
  created_at: Date;
  updated_at: Date;
};
function hydrate(row: Row): Content {
  return {
    ...row.payload,
    id: row.id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
function clean(input: unknown) {
  const result = validateContent(input);
  if (Object.keys(result.errors).length)
    throw new Error(Object.values(result.errors).join(" "));
  return result.data;
}
function key(input: ContentInput) {
  return createHash("sha256").update(fingerprint(input)).digest("hex");
}

export function createPostgresStore(pool: Pool) {
  async function write<T>(
    action: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // All writers take the same transaction lock. Imports see committed edits
      // and parallel imports cannot both insert the same fingerprint.
      await client.query("SELECT pg_advisory_xact_lock(74201919)");
      const result = await action(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
  return {
    async list() {
      const result = await pool.query<Row>(
        "SELECT * FROM content ORDER BY created_at DESC, id",
      );
      return result.rows.map(hydrate);
    },
    async create(input: unknown) {
      const data = clean(input);
      return write(async (client) => {
        const result = await client.query<Row>(
          "INSERT INTO content (id, payload, fingerprint) VALUES ($1, $2::jsonb, $3) RETURNING *",
          [randomUUID(), JSON.stringify(data), key(data)],
        );
        return hydrate(result.rows[0]);
      });
    },
    async update(id: string, input: unknown) {
      const data = clean(input);
      return write(async (client) => {
        const result = await client.query<Row>(
          "UPDATE content SET payload=$1::jsonb, fingerprint=$2, updated_at=now() WHERE id=$3 RETURNING *",
          [JSON.stringify(data), key(data), id],
        );
        return result.rows[0] ? hydrate(result.rows[0]) : null;
      });
    },
    async remove(id: string) {
      return write(
        async (client) =>
          (await client.query("DELETE FROM content WHERE id=$1", [id]))
            .rowCount !== 0,
      );
    },
    async import(inputs: unknown[]) {
      const data = inputs.map(clean);
      const unique = new Map(data.map((payload) => [key(payload), payload]));
      const batch = Array.from(unique, ([fingerprint, payload]) => ({
        id: randomUUID(),
        fingerprint,
        payload,
      }));
      return write(async (client) => {
        const result = await client.query(
          `INSERT INTO content (id, fingerprint, payload)
           SELECT row.id, row.fingerprint, row.payload
           FROM jsonb_to_recordset($1::jsonb) AS row(id text, fingerprint text, payload jsonb)
           WHERE NOT EXISTS (SELECT 1 FROM content WHERE content.fingerprint = row.fingerprint)`,
          [JSON.stringify(batch)],
        );
        const added = result.rowCount ?? 0;
        return { added, skipped: inputs.length - added };
      });
    },
  };
}

export function connectPostgres(connectionString: string) {
  const pool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 20_000,
    allowExitOnIdle: true,
  });
  pool.on("error", () =>
    console.error(
      "Koneksi database terputus; koneksi baru akan dibuat pada permintaan berikutnya.",
    ),
  );
  return createPostgresStore(pool);
}
