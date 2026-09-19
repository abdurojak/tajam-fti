import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { CATEGORIES, PRODI, type Content } from "./domain";

export async function createPDF(rows: Content[]): Promise<ArrayBuffer> {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: false,
  });
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(32, 53, 42);
  doc.rect(0, 0, width, 34, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(211, 237, 137);
  doc.setFontSize(20);
  doc.text("TAJAM FTI", 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(240, 244, 231);
  doc.setFontSize(9);
  doc.text("Laporan Perencanaan dan Monitoring Konten", 14, 24);
  doc.setFontSize(8);
  doc.text(
    new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date()),
    width - 14,
    16,
    { align: "right" },
  );
  doc.text("Tangkap - Arahkan - Jadwalkan - Aksi - Muat", width - 14, 24, {
    align: "right",
  });
  doc.setTextColor(45, 62, 43);
  const labels = ["Total", "Draf", "Terbit", "Batal"];
  labels.forEach((label, i) => {
    const x = 14 + i * 68;
    doc.setFillColor(244, 247, 237);
    doc.roundedRect(x, 40, 63, 21, 2, 2, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(label, x + 5, 47);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(
      String(
        label === "Total"
          ? rows.length
          : rows.filter((r) => r.status === label).length,
      ),
      x + 5,
      56,
    );
  });
  doc.setFontSize(10);
  doc.text("Komposisi kategori", 14, 72);
  doc.text("Program studi", 153, 72);
  for (const [options, key, startX] of [
    [CATEGORIES, "category", 14],
    [PRODI, "prodi", 153],
  ] as const) {
    const max = Math.max(
      1,
      ...options.map((label) => rows.filter((r) => r[key] === label).length),
    );
    options.forEach((label, i) => {
      const y = 80 + i * 6;
      const count = rows.filter((r) => r[key] === label).length;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(label, startX, y);
      doc.setFillColor(237, 241, 228);
      doc.rect(startX + 40, y - 2.5, 66, 2.5, "F");
      if (count) {
        doc.setFillColor(137, 163, 104);
        doc.rect(startX + 40, y - 2.5, (66 * count) / max, 2.5, "F");
      }
      doc.text(String(count), startX + 111, y);
    });
  }
  autoTable(doc, {
    startY: 120,
    margin: { left: 14, right: 14, top: 16, bottom: 18 },
    head: [
      [
        "#",
        "Konten & kegiatan",
        "Prodi / kategori",
        "Jadwal",
        "Produksi / PIC",
        "Status / publikasi",
      ],
    ],
    body: rows.map((r, i) => [
      String(i + 1),
      `${r.idea}\n\n${r.activity}${r.notes ? `\n\nCatatan: ${r.notes}` : ""}`,
      `${r.prodi}\n${r.category}`,
      `Acara: ${r.eventDate}\nUpload: ${r.uploadDate}`,
      `${r.format} / ${r.channel}\nPIC: ${r.pic}`,
      `${r.status}${r.link ? `\n${r.link}` : ""}`,
    ]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 3,
      lineColor: [229, 235, 220],
      textColor: [52, 69, 46],
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [51, 76, 49],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 244] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 83 },
      2: { cellWidth: 40 },
      3: { cellWidth: 38 },
      4: { cellWidth: 42 },
      5: { cellWidth: 56 },
    },
    rowPageBreak: "avoid",
  });
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(121, 135, 105);
    doc.text("TAJAM FTI - Laporan sesuai filter yang dipilih", 14, 201);
    doc.text(`${page} / ${total}`, width - 14, 201, { align: "right" });
  }
  return doc.output("arraybuffer");
}
