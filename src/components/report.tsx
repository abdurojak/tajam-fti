"use client";
import { Printer, Download, FileDown, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { downloadBlob } from "@/lib/download";
import { dateLabel, type Content } from "@/lib/domain";
import { Distribution } from "./dashboard";
import { Empty, Status } from "./ui";
export default function Report({
  rows,
  onExcel,
  busy,
}: {
  rows: Content[];
  onExcel: () => void;
  busy: boolean;
}) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  async function exportPDF() {
    setPdfBusy(true);
    setPdfError("");
    try {
      const { createPDF } = await import("@/lib/pdf");
      const data = await createPDF(rows);
      downloadBlob(
        new Blob([data], { type: "application/pdf" }),
        "Laporan_TAJAM_FTI.pdf",
      );
    } catch {
      setPdfError("PDF gagal dibuat. Silakan coba lagi.");
    } finally {
      setPdfBusy(false);
    }
  }
  return (
    <>
      <div className="report-actions">
        <p>Laporan dan unduhan mengikuti filter yang dipilih.</p>
        <button
          className="button secondary"
          disabled={!rows.length || busy}
          onClick={onExcel}
        >
          <Download size={16} />
          Excel
        </button>
        <button
          className="button secondary"
          onClick={() => window.print()}
          disabled={!rows.length}
        >
          <Printer size={16} />
          Cetak
        </button>
        <button
          className="button primary"
          onClick={exportPDF}
          disabled={!rows.length || pdfBusy}
        >
          {pdfBusy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <FileDown size={16} />
          )}{" "}
          {pdfBusy ? "Membuat PDF…" : "Unduh PDF"}
        </button>
      </div>
      {pdfError && (
        <div className="notice error" role="alert">
          {pdfError}
        </div>
      )}
      <article className="report-paper">
        <header className="report-header">
          <div>
            <span className="eyebrow">TAJAM FTI / LAPORAN KONTEN</span>
            <h2>Rencana menjadi cerita.</h2>
            <p>Perencanaan dan monitoring konten Fakultas Teknologi Industri</p>
          </div>
          <div>
            <strong>{rows.length} konten</strong>
            <small>
              Dicetak{" "}
              {new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(
                new Date(),
              )}
            </small>
          </div>
        </header>
        <div className="report-stats">
          {["Draf", "Terbit", "Batal"].map((status) => (
            <div key={status}>
              <span>{status}</span>
              <strong>{rows.filter((r) => r.status === status).length}</strong>
            </div>
          ))}
        </div>
        {rows.length ? (
          <>
            <div className="report-charts">
              <div>
                <h3>Distribusi kategori</h3>
                <Distribution rows={rows} />
              </div>
              <div>
                <h3>Distribusi program studi</h3>
                <Distribution rows={rows} by="prodi" />
              </div>
            </div>
            <div className="table-scroll">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Rencana konten</th>
                    <th>Jadwal</th>
                    <th>Produksi</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id}>
                      <td>{i + 1}</td>
                      <td>
                        <strong>{r.idea}</strong>
                        <small>{r.activity}</small>
                        <small>
                          {r.prodi} · {r.category}
                        </small>
                        {r.notes && <small>Catatan: {r.notes}</small>}
                        {r.link && <a href={r.link}>{r.link}</a>}
                      </td>
                      <td>
                        <small>Acara: {dateLabel(r.eventDate, true)}</small>
                        <small>Upload: {dateLabel(r.uploadDate, true)}</small>
                      </td>
                      <td>
                        <small>
                          {r.format} · {r.channel}
                        </small>
                        <small>PIC: {r.pic}</small>
                      </td>
                      <td>
                        <Status status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <Empty
            title="Belum ada data laporan"
            description="Tambahkan konten atau sesuaikan filter laporan."
          />
        )}
        <footer className="report-footer">
          TAJAM FTI <span>Tangkap · Arahkan · Jadwalkan · Aksi · Muat</span>
        </footer>
      </article>
    </>
  );
}
