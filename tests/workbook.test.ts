import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { parseWorkbook, createWorkbook, HEADERS } from "../src/lib/workbook";
import { valid } from "./fixtures";
import { readFileSync } from "node:fs";
describe("impor dan ekspor Excel", () => {
  it("menggunakan daftar prodi sesuai cakupan pada validasi template", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      (await createWorkbook([], {
        studyPrograms: ["Sistem Informasi"],
      })) as ExcelJS.Buffer,
    );
    const reference = workbook.getWorksheet("Referensi");
    expect(reference?.getCell("A2").value).toBe("Sistem Informasi");
    expect(reference?.getCell("A3").value).toBe("");
  });
  it("membaca template asli dengan namespace XML berawalan x", async () => {
    const buffer = readFileSync("tests/fixtures/template-original.xlsx");
    expect(await parseWorkbook(Uint8Array.from(buffer).buffer)).toEqual([]);
  });
  it("round-trip semua kolom termasuk teks yang diawali tanda sama dengan", async () => {
    const input = { ...valid, notes: "=SUM(1,2)" };
    const rows = await parseWorkbook(await createWorkbook([input]));
    expect(rows).toHaveLength(1);
    expect(rows[0].data).toEqual(input);
    expect(rows[0].errors).toEqual({});
  });
  it("mengabaikan baris kosong dan mempertahankan nomor baris error", async () => {
    const w = new ExcelJS.Workbook();
    const s = w.addWorksheet("Template Import");
    s.addRow(HEADERS);
    s.addRow([]);
    s.addRow(["Teknik Mesin"]);
    const rows = await parseWorkbook(await w.xlsx.writeBuffer());
    expect(rows).toHaveLength(1);
    expect(rows[0].row).toBe(3);
    expect(rows[0].errors.idea).toBeTruthy();
  });
  it("menolak header yang berubah", async () => {
    const w = new ExcelJS.Workbook();
    w.addWorksheet("Template Import").addRow(["Salah"]);
    await expect(parseWorkbook(await w.xlsx.writeBuffer())).rejects.toThrow(
      "Header",
    );
  });
  it("menolak formula sebagai data agar tidak menerima hasil cache yang usang", async () => {
    const w = new ExcelJS.Workbook();
    const s = w.addWorksheet("Template Import");
    s.addRow(HEADERS);
    s.addRow(["Teknik Mesin", { formula: "1+1", result: 2 }]);
    const rows = await parseWorkbook(await w.xlsx.writeBuffer());
    expect(rows[0].errors.activity).toContain("Formula");
  });
});
