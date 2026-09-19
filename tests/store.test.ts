import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../src/lib/store";
import { localAdminAccess } from "../src/lib/organization";
import type { AccessContext } from "../src/lib/organization";
import { valid } from "./fixtures";
const admin = localAdminAccess();
describe("penyimpanan SQLite", () => {
  it("menyimpan perubahan setelah restart koneksi dan menghapus hanya id tujuan", () => {
    const dir = mkdtempSync(join(tmpdir(), "tajam-test-"));
    const path = join(dir, "test.db");
    const store = createStore(path);
    const record = store.create(valid, admin);
    const other = store.create({ ...valid, idea: "Ide lain" }, admin);
    store.update(record.id, { ...valid, status: "Terbit" }, admin);
    store.close();
    const reopened = createStore(path);
    expect(reopened.list(admin).find((x) => x.id === record.id)?.status).toBe(
      "Terbit",
    );
    reopened.remove(record.id, admin);
    expect(reopened.list(admin).map((x) => x.id)).toEqual([other.id]);
    reopened.close();
    rmSync(dir, { recursive: true, force: true });
  });
  it("melewati duplikat pada impor berulang", () => {
    const s = createStore(":memory:");
    expect(s.import([valid, valid], admin)).toEqual({ added: 1, skipped: 1 });
    expect(s.import([valid], admin)).toEqual({ added: 0, skipped: 1 });
    s.close();
  });
  it("menolak seluruh batch jika satu data invalid", () => {
    const s = createStore(":memory:");
    expect(() => s.import([valid, { ...valid, pic: "" }], admin)).toThrow();
    expect(s.list(admin)).toHaveLength(0);
    s.close();
  });
  it("membatasi baca dan tulis berdasarkan cakupan prodi", () => {
    const s = createStore(":memory:");
    const siEditor: AccessContext = {
      email: "aszani@trisakti.ac.id",
      role: "editor",
      scopeType: "study_program",
      scopeId: "sistem-informasi",
      allowedProgramIds: ["sistem-informasi"],
    };
    s.create(valid, admin);
    s.create({ ...valid, prodi: "Sistem Informasi", idea: "SI" }, admin);
    expect(s.list(siEditor).map((x) => x.idea)).toEqual(["SI"]);
    expect(() => s.create(valid, siEditor)).toThrow("di luar cakupan");
    s.close();
  });
  it("menolak mutasi viewer dan impor lintas cakupan secara atomik", () => {
    const s = createStore(":memory:");
    const viewer: AccessContext = {
      email: "viewer@trisakti.ac.id",
      role: "viewer",
      scopeType: "department",
      scopeId: "teknik-informatika",
      allowedProgramIds: ["teknik-informatika", "sistem-informasi"],
    };
    expect(() => s.create(valid, viewer)).toThrow();
    const editor = { ...viewer, role: "editor" as const };
    expect(() =>
      s.import(
        [
          { ...valid, prodi: "Sistem Informasi", idea: "Diizinkan" },
          { ...valid, prodi: "Teknik Mesin", idea: "Ditolak" },
        ],
        editor,
      ),
    ).toThrow("di luar cakupan");
    expect(s.list(admin)).toHaveLength(0);
    s.close();
  });
});
