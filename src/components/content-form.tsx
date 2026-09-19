"use client";
import { useState } from "react";
import { AlertTriangle, Check, LoaderCircle } from "lucide-react";
import {
  CATEGORIES,
  CHANNELS,
  EMPTY,
  FORMATS,
  LABELS,
  PRODI,
  STATUSES,
  validateContent,
  type Content,
  type ContentInput,
  type Field,
} from "@/lib/domain";
import { Dialog, ExternalLink } from "./ui";
export default function ContentForm({
  record,
  onClose,
  onSave,
  studyPrograms = [...PRODI],
}: {
  record: Content | null;
  onClose: () => void;
  onSave: (data: ContentInput, id?: string) => Promise<void>;
  studyPrograms?: string[];
}) {
  const [form, setForm] = useState<ContentInput>(
    record ?? {
      ...EMPTY,
      prodi: studyPrograms.length === 1 ? studyPrograms[0] : "",
    },
  );
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (field: Field, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  };
  const field = (key: Field, options?: readonly string[], type = "text") => (
    <label
      className={`field ${["activity", "idea", "notes", "link"].includes(key) ? "span-2" : ""}`}
      key={key}
    >
      <span>
        {LABELS[key]}
        {!["link", "notes"].includes(key) && <b> *</b>}
      </span>
      {options ? (
        <select
          aria-invalid={!!errors[key]}
          value={form[key]}
          onChange={(e) => set(key, e.target.value)}
        >
          <option value="">Pilih {LABELS[key].toLowerCase()}</option>
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : ["activity", "idea", "notes"].includes(key) ? (
        <textarea
          rows={key === "notes" ? 2 : 3}
          value={form[key]}
          onChange={(e) => set(key, e.target.value)}
          aria-invalid={!!errors[key]}
          placeholder={
            key === "activity"
              ? "Apa kegiatan atau informasi yang ingin dibagikan?"
              : key === "idea"
                ? "Sudut cerita apa yang ingin kamu angkat?"
                : "Tambahkan detail atau kebutuhan produksi…"
          }
          maxLength={4000}
        />
      ) : (
        <input
          type={type}
          min={type === "date" ? "1900-01-01" : undefined}
          max={type === "date" ? "2200-12-31" : undefined}
          value={form[key]}
          aria-invalid={!!errors[key]}
          onChange={(e) => set(key, e.target.value)}
          placeholder={
            key === "pic"
              ? "Nama penanggung jawab"
              : key === "link"
                ? "https://…"
                : undefined
          }
          maxLength={500}
        />
      )}
      {errors[key] && <small className="field-error">{errors[key]}</small>}
    </label>
  );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = validateContent(form);
    setErrors(result.errors);
    if (Object.keys(result.errors).length) {
      setError("Periksa kembali kolom yang ditandai.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await onSave(result.data, record?.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={record ? "Detail & edit konten" : "Rencanakan konten baru"}
      subtitle="Dari ide kecil menjadi cerita yang berarti."
      onClose={() => {
        if (!busy) onClose();
      }}
      wide
    >
      <form noValidate onSubmit={submit}>
        <div className="modal-body">
          <div className="form-section">
            <span className="section-number">01</span>
            <h3>Tangkap & arahkan</h3>
          </div>
          <div className="form-grid">
            {studyPrograms.length === 1 ? (
              <label className="field">
                <span>Program studi</span>
                <input value={studyPrograms[0]} disabled />
              </label>
            ) : (
              field("prodi", studyPrograms)
            )}
            {field("category", CATEGORIES)}
            {field("activity")}
            {field("idea")}
          </div>
          <div className="form-section">
            <span className="section-number">02</span>
            <h3>Jadwalkan & kerjakan</h3>
          </div>
          <div className="form-grid">
            {field("eventDate", undefined, "date")}
            {field("uploadDate", undefined, "date")}
            {field("format", FORMATS)}
            {field("channel", CHANNELS)}
            {field("pic")}
            {field("status", STATUSES)}
          </div>
          {form.eventDate && form.eventDate === form.uploadDate && (
            <div className="notice warning">
              <AlertTriangle size={17} />
              Tanggal acara dan upload sama. Kamu tetap bisa menyimpan jika
              sudah sesuai.
            </div>
          )}
          <div className="form-section">
            <span className="section-number">03</span>
            <h3>Muat & catat</h3>
          </div>
          <div className="form-grid">
            {field("link", undefined, "url")}
            {field("notes")}
          </div>
          {record?.link && <ExternalLink url={record.link} />}
          <p className="field-hint">
            Draf: direncanakan atau dikerjakan · Terbit: sudah dipublikasikan ·
            Batal: tidak dilanjutkan.
          </p>
          {error && (
            <div role="alert" className="notice error">
              {error}
            </div>
          )}
        </div>
        <footer className="modal-footer">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Tutup
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Check size={17} />
            )}{" "}
            {busy ? "Menyimpan…" : "Simpan konten"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
