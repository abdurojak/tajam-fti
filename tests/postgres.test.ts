import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { valid } from "./fixtures";

// Dedicated disposable DB only. Never falls back to the application's DATABASE_URL.
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "PostgreSQL integration",
  () => {
    let pool: Pool;
    let store: Awaited<
      ReturnType<typeof import("../src/lib/postgres-store").createPostgresStore>
    >;
    beforeAll(async () => {
      pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
      await pool.query(readFileSync("db/001-content.sql", "utf8"));
      const { createPostgresStore } = await import("../src/lib/postgres-store");
      store = createPostgresStore(pool);
    });
    beforeEach(async () => {
      await pool.query("DELETE FROM content");
    });
    afterAll(async () => {
      await pool?.end();
    });
    it("persists CRUD and preserves dates, ids, and timestamps", async () => {
      const first = await store.create(valid);
      const second = await store.create({ ...valid, idea: "Another" });
      expect(first.id).toBeTruthy();
      expect(first.createdAt).toMatch(/^\d{4}-/);
      expect(first.eventDate).toBe(valid.eventDate);
      expect(
        (await store.update(first.id, { ...valid, status: "Terbit" }))?.status,
      ).toBe("Terbit");
      const otherPool = new Pool({
        connectionString: process.env.TEST_DATABASE_URL,
      });
      try {
        const { createPostgresStore } =
          await import("../src/lib/postgres-store");
        expect(await createPostgresStore(otherPool).list()).toHaveLength(2);
      } finally {
        await otherPool.end();
      }
      expect(await store.remove(first.id)).toBe(true);
      expect((await store.list()).map((x) => x.id)).toEqual([second.id]);
      expect(await store.update("missing", valid)).toBeNull();
      expect(await store.remove("missing")).toBe(false);
    });
    it("deduplicates the same workbook even when two people import at once", async () => {
      const results = await Promise.all([
        store.import([valid, valid]),
        store.import([valid]),
      ]);
      expect(results.reduce((sum, r) => sum + r.added, 0)).toBe(1);
      expect(results.reduce((sum, r) => sum + r.skipped, 0)).toBe(2);
      expect(await store.list()).toHaveLength(1);
    });
    it("rolls back the whole invalid batch", async () => {
      await expect(
        store.import([valid, { ...valid, pic: "" }]),
      ).rejects.toThrow();
      expect(await store.list()).toHaveLength(0);
    });
    it("recognizes duplicates after editing a row", async () => {
      const row = await store.create(valid);
      const updated = { ...valid, status: "Terbit" };
      await store.update(row.id, updated);
      expect(await store.import([updated, valid])).toEqual({
        added: 1,
        skipped: 1,
      });
    });
    it("keeps quotes and SQL-looking text as ordinary content", async () => {
      const input = { ...valid, idea: "'); DROP TABLE content; --" };
      const row = await store.create(input);
      expect((await store.list())[0].idea).toBe(input.idea);
      expect(await store.remove(row.id)).toBe(true);
    });
  },
);
