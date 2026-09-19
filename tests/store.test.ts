import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../src/lib/store";
import { valid } from "./fixtures";
describe("penyimpanan SQLite", () => {
  it("menyimpan perubahan setelah restart koneksi dan menghapus hanya id tujuan", () => {
    const dir = mkdtempSync(join(tmpdir(), "tajam-test-"));
    const path = join(dir, "test.db");
    const store = createStore(path);
    const record = store.create(valid);
    const other = store.create({ ...valid, idea: "Ide lain" });
    store.update(record.id, { ...valid, status: "Terbit" });
    store.close();
    const reopened = createStore(path);
    expect(reopened.list().find((x) => x.id === record.id)?.status).toBe(
      "Terbit",
    );
    reopened.remove(record.id);
    expect(reopened.list().map((x) => x.id)).toEqual([other.id]);
    reopened.close();
    rmSync(dir, { recursive: true, force: true });
  });
  it("melewati duplikat pada impor berulang", () => {
    const s = createStore(":memory:");
    expect(s.import([valid, valid])).toEqual({ added: 1, skipped: 1 });
    expect(s.import([valid])).toEqual({ added: 0, skipped: 1 });
    s.close();
  });
  it("menolak seluruh batch jika satu data invalid", () => {
    const s = createStore(":memory:");
    expect(() => s.import([valid, { ...valid, pic: "" }])).toThrow();
    expect(s.list()).toHaveLength(0);
    s.close();
  });
});
