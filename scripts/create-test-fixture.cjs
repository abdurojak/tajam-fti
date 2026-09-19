// Disposable browser-test input, separate from the user's original template.
const ExcelJS = require("exceljs");
const fs = require("node:fs");
async function main() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Template Import");
  sheet.addRow([
    "Prodi",
    "Kegiatan/Informasi Awal",
    "Ide Konten",
    "Kategori Konten",
    "Status Konten",
    "Tanggal Acara",
    "Tanggal Upload",
    "Format",
    "Channel",
    "PIC",
    "Link Publikasi (Opsional)",
    "Catatan (Opsional)",
  ]);
  sheet.getRow(2).values = [
    "Teknik Elektro",
    "Uji impor",
    "Sorotan riset elektro",
    "Science & Impact",
    "Draf",
    new Date("2026-09-24T00:00:00Z"),
    new Date("2026-09-25T00:00:00Z"),
    "Carousel",
    "Instagram",
    "Tim Uji",
    "",
    "Data pengujian",
  ];
  fs.mkdirSync("test-results", { recursive: true });
  await workbook.xlsx.writeFile("test-results/import-ui.xlsx");
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
