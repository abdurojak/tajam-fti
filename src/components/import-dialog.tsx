"use client";
import { useRef, useState } from "react";
import {
  FileSpreadsheet,
  Upload,
  Download,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { type Content, type ContentInput, fingerprint } from "@/lib/domain";
import type { ImportRow } from "@/lib/workbook";
import { Dialog } from "./ui";
export default function ImportDialog({
  rows,
  onClose,
  onImport,
  onTemplate,
}: {
  rows: Content[];
  onClose: () => void;
  onImport: (rows: ContentInput[]) => Promise<void>;
  onTemplate: () => void;
}) {
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const seen = new Set(rows.map(fingerprint));
  const duplicates = new Set<number>();
  for (const row of preview) {
    if (!Object.keys(row.errors).length) {
      const key = fingerprint(row.data);
      if (seen.has(key)) duplicates.add(row.row);
      else seen.add(key);
    }
  }
  const invalid = preview.filter((r) => Object.keys(r.errors).length).length;
  const valid = preview.length - invalid - duplicates.size;
  async function read(file?: File) {
    if (!file) return;
    setError("");
    setPreview([]);
    setFilename(file.name);
    if (!/\.xlsx$/i.test(file.name)) {
      setError("Pilih file Excel dengan format .xlsx.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran file maksimal 5 MB.");
      return;
    }
    setBusy(true);
    try {
      const { parseWorkbook } = await import("@/lib/workbook");
      const data = await parseWorkbook(await file.arrayBuffer());
      setPreview(data);
      if (!data.length)
        setError(
          "Sheet Template Import masih kosong. Isi rencana konten terlebih dahulu.",
        );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "File tidak dapat dibaca. Pastikan format Excel valid.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      await onImport(
        preview.filter((r) => !duplicates.has(r.row)).map((r) => r.data),
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impor gagal.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Impor rencana konten"
      subtitle="Dari spreadsheet ke ruang kerja, tanpa mengetik ulang."
      onClose={() => {
        if (!busy) onClose();
      }}
      wide
    >
      <div className="modal-body">
        <div className="import-instructions">
          <span className="file-icon">
            <FileSpreadsheet size={23} />
          </span>
          <div>
            <strong>Gunakan template TAJAM FTI</strong>
            <p>
              Status yang digunakan: Draf, Terbit, Batal. Status approval lama
              perlu diganti di Excel.
            </p>
          </div>
          <button className="button secondary small" onClick={onTemplate}>
            <Download size={15} />
            Template
          </button>
        </div>
        <input
          ref={ref}
          type="file"
          accept=".xlsx"
          className="sr-only"
          aria-label="Pilih file Excel"
          onChange={(e) => {
            void read(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          className="dropzone"
          disabled={busy}
          onClick={() => ref.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!busy) void read(e.dataTransfer.files[0]);
          }}
        >
          {busy ? (
            <LoaderCircle className="spin" size={32} />
          ) : (
            <Upload size={32} />
          )}
          <strong>
            {busy
              ? "Memproses file…"
              : filename || "Pilih atau letakkan file Excel di sini"}
          </strong>
          <span>.xlsx · Maks. 5 MB · 5.000 baris</span>
        </button>
        <p className="field-hint">
          File dibaca di browser. Hanya data konten yang disimpan; file asli
          tidak diunggah.
        </p>
        {error && (
          <div className="notice error" role="alert">
            <AlertCircle size={18} />
            {error}
          </div>
        )}
        {preview.length > 0 && (
          <>
            <div className="import-summary">
              <span>
                <CheckCircle2 size={17} />
                {valid} siap diimpor
              </span>
              <span>{duplicates.size} duplikat dilewati</span>
              <span className={invalid ? "red-text" : ""}>
                {invalid} baris perlu diperbaiki
              </span>
            </div>
            <div className="import-preview">
              <table>
                <thead>
                  <tr>
                    <th>Baris</th>
                    <th>Ide konten</th>
                    <th>Hasil pemeriksaan</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => (
                    <tr key={row.row}>
                      <td>{row.row}</td>
                      <td>
                        {row.data.idea || "—"}
                        <small>{row.data.prodi}</small>
                      </td>
                      <td>
                        {Object.keys(row.errors).length ? (
                          <span className="red-text">
                            {Object.values(row.errors).join(" ")}
                          </span>
                        ) : duplicates.has(row.row) ? (
                          <span className="muted">Duplikat, akan dilewati</span>
                        ) : (
                          <span
                            className={
                              row.warnings.length ? "amber-text" : "green-text"
                            }
                          >
                            {row.warnings.join(" ") || "Siap diimpor"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {invalid > 0 && (
              <p className="field-hint red-text">
                Perbaiki semua baris bermasalah di Excel, lalu pilih ulang file.
                Belum ada data yang disimpan.
              </p>
            )}
          </>
        )}
      </div>
      <footer className="modal-footer">
        <button className="button secondary" onClick={onClose} disabled={busy}>
          Tutup
        </button>
        <button
          className="button primary"
          disabled={busy || invalid > 0 || valid === 0}
          onClick={save}
        >
          <Upload size={16} />
          Impor {valid} konten
        </button>
      </footer>
    </Dialog>
  );
}
