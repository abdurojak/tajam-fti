import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { valid } from "./fixtures";
import { localAdminAccess } from "../src/lib/organization";
const admin = localAdminAccess();

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
      await pool.query(readFileSync("db/002-organizational-access.sql", "utf8"));
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
      const first = await store.create(valid, admin);
      const second = await store.create({ ...valid, idea: "Another" }, admin);
      expect(first.id).toBeTruthy();
      expect(first.createdAt).toMatch(/^\d{4}-/);
      expect(first.eventDate).toBe(valid.eventDate);
      expect(
        (await store.update(first.id, { ...valid, status: "Terbit" }, admin))?.status,
      ).toBe("Terbit");
      const otherPool = new Pool({
        connectionString: process.env.TEST_DATABASE_URL,
      });
      try {
        const { createPostgresStore } =
          await import("../src/lib/postgres-store");
        expect(await createPostgresStore(otherPool).list(admin)).toHaveLength(2);
      } finally {
        await otherPool.end();
      }
      expect(await store.remove(first.id, admin)).toBe(true);
      expect((await store.list(admin)).map((x) => x.id)).toEqual([second.id]);
      expect(await store.update("missing", valid, admin)).toBeNull();
      expect(await store.remove("missing", admin)).toBe(false);
    });
    it("deduplicates the same workbook even when two people import at once", async () => {
      const results = await Promise.all([
        store.import([valid, valid], admin),
        store.import([valid], admin),
      ]);
      expect(results.reduce((sum, r) => sum + r.added, 0)).toBe(1);
      expect(results.reduce((sum, r) => sum + r.skipped, 0)).toBe(2);
      expect(await store.list(admin)).toHaveLength(1);
    });
    it("rolls back the whole invalid batch", async () => {
      await expect(
        store.import([valid, { ...valid, pic: "" }], admin),
      ).rejects.toThrow();
      expect(await store.list(admin)).toHaveLength(0);
    });
    it("recognizes duplicates after editing a row", async () => {
      const row = await store.create(valid, admin);
      const updated = { ...valid, status: "Terbit" };
      await store.update(row.id, updated, admin);
      expect(await store.import([updated, valid], admin)).toEqual({
        added: 1,
        skipped: 1,
      });
    });
    it("keeps quotes and SQL-looking text as ordinary content", async () => {
      const input = { ...valid, idea: "'); DROP TABLE content; --" };
      const row = await store.create(input, admin);
      expect((await store.list(admin))[0].idea).toBe(input.idea);
      expect(await store.remove(row.id, admin)).toBe(true);
    });
  },
);
