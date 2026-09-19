"use client";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  FilePenLine,
  Layers3,
  Plus,
  Sparkles,
  Target,
} from "lucide-react";
import {
  CATEGORIES,
  dateLabel,
  today,
  type Content,
} from "@/lib/domain";
import ContentTable from "./content-table";
import { Empty } from "./ui";
export function Distribution({
  rows,
  by = "category",
}: {
  rows: Content[];
  by?: "category" | "prodi";
}) {
  const choices =
    by === "category"
      ? CATEGORIES
      : Array.from(new Set(rows.map((row) => row.prodi))).sort();
  const max = Math.max(
    1,
    ...choices.map((c) => rows.filter((r) => r[by] === c).length),
  );
  return (
    <div className="distribution">
      {choices.map((name, i) => {
        const count = rows.filter((r) => r[by] === name).length;
        return (
          <div className="bar-item" key={name}>
            <div>
              <span>
                <i
                  style={{
                    background: [
                      "#729775",
                      "#ae8bc6",
                      "#d9ad66",
                      "#729daf",
                      "#ba8585",
                      "#8b9575",
                    ][i],
                  }}
                />
                {name}
              </span>
              <strong>{count}</strong>
            </div>
            <div className="bar-track">
              <span
                style={{
                  width: `${(count / max) * 100}%`,
                  background: [
                    "#729775",
                    "#ae8bc6",
                    "#d9ad66",
                    "#729daf",
                    "#ba8585",
                    "#8b9575",
                  ][i],
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
export default function Dashboard({
  rows,
  onAdd,
  onEdit,
  onNavigate,
  onSample,
  busy,
  canWrite = true,
}: {
  rows: Content[];
  onAdd: () => void;
  onEdit: (r: Content) => void;
  onNavigate: (page: string) => void;
  onSample: () => void;
  busy: boolean;
  canWrite?: boolean;
}) {
  const active = rows.filter((r) => r.status !== "Batal");
  const published = active.filter((r) => r.status === "Terbit").length;
  const draft = active.filter((r) => r.status === "Draf").length;
  const current = today();
  const month = current.slice(0, 7);
  const upcoming = active
    .filter((r) => r.status === "Draf" && r.uploadDate >= current)
    .sort((a, b) => a.uploadDate.localeCompare(b.uploadDate))
    .slice(0, 4);
  const recent = [...active]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);
  return (
    <>
      <section className="welcome">
        <div>
          <div className="eyebrow">
            <span className="live-dot" /> RUANG KREATIF FTI
          </div>
          <h1>
            Ide hari ini.
            <br />
            <span>Cerita esok hari.</span>
          </h1>
          <p>
            Rencanakan, kerjakan, dan bagikan cerita terbaik FTI.
            <br className="desktop-only" /> Semua ide tim, dalam satu ruang.
          </p>
          {canWrite && (
            <button className="button dark" onClick={onAdd}>
              <Plus size={17} />
              Rencanakan konten
              <ArrowUpRight size={17} />
            </button>
          )}
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-card card-back">
            <span />
            <span />
            <span />
          </div>
          <div className="art-card card-front">
            <span className="art-label">THE NEXT BIG IDEA</span>
            <Target size={56} strokeWidth={1.2} />
            <span className="art-line" />
            <span className="art-line short" />
            <div className="art-bottom">
              <span>MAKE IT HAPPEN</span>
              <ArrowUpRight size={22} />
            </div>
          </div>
          <div className="spark-badge">
            <Sparkles size={25} />
          </div>
          <div className="small-badge">
            <CheckCheck size={18} /> Siap jadi cerita
          </div>
          <span className="art-star">✳</span>
        </div>
      </section>
      <section className="stats-grid" aria-label="Ringkasan konten">
        {[
          {
            label: "Total konten aktif",
            value: active.length,
            icon: Layers3,
            caption: "Ide yang terus bergerak",
            className: "violet",
          },
          {
            label: "Dalam draf",
            value: draft,
            icon: FilePenLine,
            caption: "Saatnya wujudkan ide",
            className: "amber",
          },
          {
            label: "Sudah terbit",
            value: published,
            icon: CheckCheck,
            caption: active.length
              ? `${Math.round((published / active.length) * 100)}% dari konten aktif`
              : "Cerita yang sudah dibagikan",
            className: "green",
          },
          {
            label: "Jadwal bulan ini",
            value: active.filter((r) => r.uploadDate.startsWith(month)).length,
            icon: CalendarDays,
            caption: new Intl.DateTimeFormat("id-ID", {
              month: "long",
              year: "numeric",
            }).format(new Date()),
            className: "blue",
          },
        ].map((item) => (
          <article className="stat-card" key={item.label}>
            <div className="stat-top">
              <span>{item.label}</span>
              <span className={`stat-icon ${item.className}`}>
                <item.icon size={18} />
              </span>
            </div>
            <strong>{item.value.toString().padStart(2, "0")}</strong>
            <p>{item.caption}</p>
          </article>
        ))}
      </section>
      <div className="dashboard-grid">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <h2>
                Rencana terbaru <span className="count">{active.length}</span>
              </h2>
              <p>Ide dan progres terbaru dari tim.</p>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("content")}
            >
              Lihat semua
              <ArrowRight size={15} />
            </button>
          </div>
          <ContentTable
            rows={recent}
            onEdit={canWrite ? onEdit : undefined}
            compact
            emptyAction={canWrite ? (
              <div className="empty-actions">
                <button className="button primary" onClick={onAdd}>
                  <Plus size={16} />
                  Tambah konten
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={onSample}
                >
                  {busy ? "Memuat…" : "Coba data contoh"}
                </button>
              </div>
            ) : undefined}
          />
          <div className="panel-foot">
            <span className="mini-dot" /> Setiap ide punya kesempatan menjadi
            cerita.
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Komposisi konten</h2>
              <p>Ragam cerita, satu tujuan.</p>
            </div>
            <span className="subtle-icon">
              <Layers3 size={19} />
            </span>
          </div>
          <Distribution rows={active} />
          <div className="chart-note">
            {active.length
              ? `${active.length} konten aktif dalam ${CATEGORIES.length} kategori`
              : "Grafik akan terisi saat kamu menambahkan konten."}
          </div>
        </section>
      </div>
      <div className="dashboard-grid bottom-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Segera tayang</h2>
              <p>Jaga ritme publikasi tim.</p>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("calendar")}
            >
              Buka kalender
              <ArrowRight size={15} />
            </button>
          </div>
          {upcoming.length ? (
            <div className="upcoming-list">
              {upcoming.map((row) => (
                <button
                  className="upcoming-item"
                  key={row.id}
                  onClick={() => canWrite && onEdit(row)}
                  disabled={!canWrite}
                >
                  <span className="date-tile">
                    <strong>{row.uploadDate.slice(8)}</strong>
                    <span>
                      {dateLabel(row.uploadDate).split(" ").slice(1).join(" ")}
                    </span>
                  </span>
                  <span className="upcoming-copy">
                    <strong>{row.idea}</strong>
                    <small>
                      {row.prodi} · {row.channel}
                    </small>
                  </span>
                  <ArrowUpRight size={18} />
                </button>
              ))}
            </div>
          ) : (
            <Empty
              title="Belum ada jadwal mendatang"
              description="Rencana berstatus Draf dengan tanggal upload mendatang akan tampil di sini."
            />
          )}
        </section>
        <section className="manifesto">
          <span className="eyebrow">CARA KITA BERCERITA</span>
          <h2>
            Konten yang baik
            <br />
            dimulai dari rencana.
          </h2>
          <div className="process-words">
            {["Tangkap", "Arahkan", "Jadwalkan", "Aksi", "Muat"].map(
              (word, i) => (
                <span key={word}>
                  <b>{word[0]}</b>
                  {word.slice(1)}
                  {i < 4 && <ArrowRight size={12} />}
                </span>
              ),
            )}
          </div>
          <div className="manifesto-footer">
            <span>TAJAM FTI</span>
            <Sparkles size={22} />
          </div>
        </section>
      </div>
    </>
  );
}
