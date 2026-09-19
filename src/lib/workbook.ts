import ExcelJS from "exceljs";
import JSZip from "jszip";
import {
  FIELDS,
  LABELS,
  PRODI,
  CATEGORIES,
  STATUSES,
  FORMATS,
  CHANNELS,
  toDateString,
  validateContent,
  type ContentInput,
  type Field,
} from "./domain";
export const HEADERS = FIELDS.map((key) => LABELS[key]);
export type ImportRow = ReturnType<typeof validateContent> & { row: number };
async function normalizeWorkbook(buffer: ArrayBuffer | ExcelJS.Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > 3000)
    throw new Error("File Excel memiliki terlalu banyak bagian.");
  let size = 0;
  for (const entry of entries) {
    if (!entry.name.endsWith(".xml") && !entry.name.endsWith(".rels")) continue;
    let xml = await entry.async("string");
    size += xml.length;
    if (size > 40_000_000)
      throw new Error(
        "Isi Excel terlalu besar. Pisahkan menjadi beberapa file.",
      );
    // ExcelJS expects unprefixed spreadsheet element names. The original
    // template uses valid OOXML x: prefixes, so normalize only that namespace.
    const declarations = [
      ...xml.matchAll(
        /xmlns:([A-Za-z_][\w.-]*)=["']http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main["']/g,
      ),
    ];
    for (const match of declarations) {
      const prefix = match[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      xml = xml.replace(new RegExp(`(<\\/?)(?:${prefix}):`, "g"), "$1");
      xml = xml.replace(
        match[0],
        'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
      );
    }
    if (declarations.length) zip.file(entry.name, xml);
  }
  return zip.generateAsync({ type: "arraybuffer" });
}
export async function parseWorkbook(
  buffer: ArrayBuffer | ExcelJS.Buffer,
): Promise<ImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(
      (await normalizeWorkbook(buffer)) as ExcelJS.Buffer,
    );
  } catch (error) {
    throw new Error(
      error instanceof Error && /terlalu/.test(error.message)
        ? error.message
        : "File Excel tidak dapat dibaca. Pastikan file .xlsx tidak rusak atau dilindungi kata sandi.",
    );
  }
  const sheet = workbook.getWorksheet("Template Import");
  if (!sheet)
    throw new Error(
      "Sheet “Template Import” tidak ditemukan. Gunakan template yang disediakan.",
    );
  for (let i = 0; i < HEADERS.length; i++)
    if (String(sheet.getCell(1, i + 1).value ?? "").trim() !== HEADERS[i])
      throw new Error(`Header kolom ${i + 1} harus “${HEADERS[i]}”.`);
  if (sheet.rowCount > 5001)
    throw new Error(
      "Maksimal 5.000 baris per impor. Pisahkan file menjadi beberapa bagian.",
    );
  const result: ImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const raw = FIELDS.map((_, i) => row.getCell(i + 1).value);
    if (
      raw.every(
        (value) =>
          value === null || value === undefined || String(value).trim() === "",
      )
    )
      return;
    const input: Partial<ContentInput> = {};
    const cellErrors: Partial<Record<Field, string>> = {};
    raw.forEach((value, index) => {
      const key = FIELDS[index];
      if (
        value &&
        typeof value === "object" &&
        ("formula" in value || "sharedFormula" in value)
      ) {
        cellErrors[key] =
          "Formula tidak didukung. Tempel sebagai nilai terlebih dahulu.";
        input[key] = "";
        return;
      }
      if (key === "eventDate" || key === "uploadDate")
        input[key] = toDateString(value, workbook.properties.date1904);
      else if (value && typeof value === "object" && "richText" in value)
        input[key] = value.richText.map((x) => x.text).join("");
      else if (value && typeof value === "object" && "text" in value)
        input[key] = String(value.text);
      else input[key] = value == null ? "" : String(value);
    });
    // Draft in the original workbook is a spelling alias, not an approval state.
    if (input.status === "Draft") input.status = "Draf";
    const parsed = validateContent(input);
    parsed.errors = { ...parsed.errors, ...cellErrors };
    result.push({ ...parsed, row: rowNumber });
  });
  return result;
}
export async function createWorkbook(rows: ContentInput[] = []) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TAJAM FTI";
  const sheet = workbook.addWorksheet("Template Import", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.addRow(HEADERS);
  sheet.autoFilter = "A1:L1";
  const widths = [24, 42, 52, 23, 18, 19, 19, 22, 18, 22, 40, 45];
  sheet.columns.forEach((column, i) => (column.width = widths[i]));
  const header = sheet.getRow(1);
  header.height = 34;
  header.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF20352C" },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  rows.forEach((item) => {
    const row = sheet.addRow(
      FIELDS.map((key) =>
        key === "eventDate" || key === "uploadDate"
          ? new Date(`${item[key]}T12:00:00Z`)
          : item[key],
      ),
    );
    row.height = 48;
    row.eachCell((cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
      cell.font = { name: "Calibri", size: 11 };
    });
    for (const index of [6, 7]) row.getCell(index).numFmt = "yyyy-mm-dd";
  });
  const ref = workbook.addWorksheet("Referensi");
  ref.addRow([
    "Prodi",
    "Kategori Konten",
    "Status Konten",
    "Format",
    "Channel",
  ]);
  const enums = [PRODI, CATEGORIES, STATUSES, FORMATS, CHANNELS];
  for (let i = 0; i < 10; i++)
    ref.addRow(enums.map((values) => values[i] ?? ""));
  ref.columns.forEach((c) => (c.width = 24));
  const targetColumns = [1, 4, 5, 8, 9];
  for (let i = 0; i < enums.length; i++)
    for (let r = 2; r <= Math.max(201, rows.length + 1); r++)
      sheet.getCell(r, targetColumns[i]).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [
          `Referensi!$${String.fromCharCode(65 + i)}$2:$${String.fromCharCode(65 + i)}$${enums[i].length + 1}`,
        ],
        showErrorMessage: true,
        error: "Pilih nilai dari daftar.",
      };
  const guide = workbook.addWorksheet("Panduan");
  guide.getColumn(1).width = 110;
  [
    "TAJAM FTI — Tangkap · Arahkan · Jadwalkan · Aksi · Muat",
    "Satu baris = satu rencana konten. Jangan mengubah header.",
    "Status: Draf (direncanakan/dikerjakan), Terbit (dipublikasikan), Batal (tidak dilanjutkan).",
    "Tanggal menggunakan YYYY-MM-DD. Tanggal acara dan upload sama menghasilkan peringatan.",
    "Semua kolom wajib kecuali Link Publikasi dan Catatan. Formula tidak didukung saat impor.",
  ].forEach((text) => guide.addRow([text]));
  return workbook.xlsx.writeBuffer();
}
