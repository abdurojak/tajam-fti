"use client";
import { useEffect, useState } from "react";
import {
  Archive,
  ArrowDownToLine,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  ListTodo,
  LoaderCircle,
  Menu,
  Plus,
  Search,
  Sparkles,
  Upload,
  Users,
  Building2,
  X,
} from "lucide-react";
import { SAMPLES, type Content, type ContentInput } from "@/lib/domain";
import Dashboard from "./dashboard";
import ContentTable, {
  DEFAULT_FILTERS,
  FilterBar,
  filterRows,
  type Filters,
} from "./content-table";
import Calendar from "./calendar";
import ContentForm from "./content-form";
import ImportDialog from "./import-dialog";
import Report from "./report";
import Guide from "./guide";
import { Dialog } from "./ui";
import { downloadBlob } from "@/lib/download";
import { LogoutButton } from "./login-button";
import type { AccessSummary } from "@/lib/organization";
import type { CalendarContent } from "@/lib/calendar-sync";
import { calendarBatchIds, calendarRetryResult } from "@/lib/calendar-ui";
import MemberManager from "./member-manager";
import OrganizationManager from "./organization-manager";
const NAV = [
  { id: "dashboard", label: "Ringkasan", icon: LayoutDashboard },
  { id: "content", label: "Rencana konten", icon: ListTodo },
  { id: "calendar", label: "Kalender", icon: CalendarDays },
  { id: "report", label: "Laporan", icon: FileText },
  { id: "archive", label: "Arsip", icon: Archive },
];
const TITLES: Record<string, { title: string; description: string }> = {
  content: {
    title: "Ruang untuk setiap ide.",
    description:
      "Kelola rencana, atur jadwal, dan ikuti perjalanan konten tim.",
  },
  calendar: {
    title: "Cerita punya waktunya.",
    description:
      "Lihat tanggal acara dan rencana publikasi dalam satu kalender.",
  },
  report: {
    title: "Lihat hasil perjalanan.",
    description: "Ringkasan terukur untuk langkah kreatif berikutnya.",
  },
  archive: {
    title: "Ide yang beristirahat.",
    description:
      "Konten berstatus Batal tetap tersimpan dan bisa dilanjutkan kembali.",
  },
  guide: {
    title: "Kenali TAJAM FTI.",
    description: "Panduan sederhana untuk ritme kerja tim yang lebih terarah.",
  },
  members: {
    title: "Anggota dan akses.",
    description: "Atur role serta cakupan kerja setiap anggota tim.",
  },
  organization: {
    title: "Struktur FTI.",
    description: "Kelola jurusan dan program studi tanpa kehilangan riwayat.",
  },
};
async function request<T>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers:
      method === "GET" ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response.json();
  if (response.status === 401) window.location.assign("/login");
  if (!response.ok)
    throw new Error(data.error || "Permintaan gagal. Coba lagi.");
  return data as T;
}
export default function Planner({
  cloud = false,
  access,
}: {
  cloud?: boolean;
  access: AccessSummary;
}) {
  const [rows, setRows] = useState<CalendarContent[]>([]);
  const [page, setPage] = useState("dashboard");
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS });
  const [form, setForm] = useState<Content | null | undefined>(undefined);
  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState<Content | null>(null);
  const [menu, setMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(
    null,
  );
  const canWrite = access.capabilities.canWriteContent;
  const navItems = access.capabilities.canManageMembers
    ? [
        ...NAV,
        { id: "members", label: "Kelola anggota", icon: Users },
        { id: "organization", label: "Kelola organisasi", icon: Building2 },
      ]
    : NAV;
  async function reload() {
    try {
      const data = await request<CalendarContent[]>("/api/content");
      setRows(data);
      setLoadError("");
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Tidak dapat memuat data.",
      );
      throw err;
    }
  }
  useEffect(() => {
    void reload()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  const notify = (text: string, error = false) => setToast({ text, error });
  function navigate(next: string) {
    setPage(next);
    setFilters({ ...DEFAULT_FILTERS });
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const active = rows.filter((row) => row.status !== "Batal");
  const base =
    page === "archive"
      ? rows.filter((r) => r.status === "Batal")
      : page === "report"
        ? rows
        : active;
  const filtered = filterRows(base, filters).sort((a, b) =>
    a.uploadDate.localeCompare(b.uploadDate),
  );
  async function save(data: ContentInput, id?: string) {
    const saved = await request<CalendarContent>(
      id ? `/api/content/${id}` : "/api/content",
      id ? "PUT" : "POST",
      data,
    );
    setRows((previous) => [
      saved,
      ...previous.filter((row) => row.id !== saved.id),
    ]);
    const baseMessage = id
      ? "Perubahan konten tersimpan."
      : "Rencana konten berhasil ditambahkan.";
    notify(
      saved.calendarSync.status === "failed"
        ? `${baseMessage} Kalender belum tersinkron: ${saved.calendarSync.error}`
        : baseMessage,
      saved.calendarSync.status === "failed",
    );
  }
  async function importRows(data: ContentInput[]) {
    const result = await request<{ added: number; skipped: number; ids: string[] }>(
      "/api/import",
      "POST",
      data,
    );
    let calendarFailures = 0;
    if (cloud) {
      for (const batch of calendarBatchIds(result.ids)) {
        try {
          const synced = await request<{ failed: unknown[] }>("/api/calendar/sync", "POST", { ids: batch });
          calendarFailures += synced.failed.length;
        } catch {
          calendarFailures += batch.length;
        }
      }
    }
    // The import has committed; a refresh failure must not invite a repeat save.
    await reload().catch(() => {});
    notify(
      `${result.added} konten ditambahkan${result.skipped ? `, ${result.skipped} duplikat dilewati` : ""}${calendarFailures ? `; ${calendarFailures} agenda perlu disinkronkan ulang` : ""}.`,
      calendarFailures > 0,
    );
  }
  async function retryCalendar(row: CalendarContent) {
    try {
      const response = await request<{ synced: string[]; failed: { id: string; error: string | null }[] }>(
        "/api/calendar/sync", "POST", { ids: [row.id] },
      );
      await reload();
      const outcome = calendarRetryResult(response, row.id);
      notify(outcome.message, !outcome.ok);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Sinkronisasi gagal.", true);
    }
  }
  async function sample() {
    setBusy(true);
    try {
      await importRows(SAMPLES);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal memuat contoh.", true);
    } finally {
      setBusy(false);
    }
  }
  async function excel(template = false) {
    setBusy(true);
    try {
      const { createWorkbook } = await import("@/lib/workbook");
      const buffer = await createWorkbook(template ? [] : filtered, {
        studyPrograms: access.studyPrograms
          .filter((program) => program.active)
          .map((program) => program.name),
      });
      downloadBlob(
        new Blob([new Uint8Array(buffer as ArrayBuffer)], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        template ? "Template_TAJAM_FTI.xlsx" : "Rencana_Konten_TAJAM_FTI.xlsx",
      );
      notify(
        template ? "Template berhasil diunduh." : "Excel berhasil diekspor.",
      );
    } catch {
      notify("File Excel tidak dapat dibuat. Silakan coba lagi.", true);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await request(`/api/content/${deleting.id}`, "DELETE");
      setRows((previous) => previous.filter((row) => row.id !== deleting.id));
      setDeleting(null);
      notify("Konten berhasil dihapus.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal menghapus.", true);
    } finally {
      setBusy(false);
    }
  }
  const label =
    page === "guide" ? "Panduan" : navItems.find((item) => item.id === page)?.label;
  return (
    <div className="app-shell">
      {menu && (
        <button
          className="sidebar-backdrop"
          aria-label="Tutup navigasi"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <button
          className="brand"
          onClick={() => navigate("dashboard")}
          aria-label="TAJAM FTI beranda"
        >
          <span className="brand-mark">
            <ArrowUpRight size={27} strokeWidth={2.5} />
          </span>
          <span>
            TAJAM<span className="brand-fti">FTI</span>
            <small>CONTENT WORKSPACE</small>
          </span>
        </button>
        <div className="workspace">
          <span className="workspace-icon">F</span>
          <div>
            <strong>Tim Kreatif FTI</strong>
            <small>Ruang kerja bersama</small>
          </div>
          <span className="workspace-dot" />
        </div>
        <span className="nav-label">RUANG KERJA</span>
        <nav>
          {navItems.map((item) => (
            <button
              className={`nav-item ${page === item.id ? "active" : ""}`}
              key={item.id}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.id === "content" && (
                <span className="nav-count">{active.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Sparkles size={19} />
            <strong>Setiap ide berarti.</strong>
            <p>
              Tangkap hari ini,
              <br />
              bagikan esok hari.
            </p>
            <button onClick={() => navigate("guide")}>
              Kenali TAJAM <ArrowUpRight size={15} />
            </button>
          </div>
          <button
            className={`nav-item ${page === "guide" ? "active" : ""}`}
            onClick={() => navigate("guide")}
          >
            <CircleHelp size={19} />
            <span>Panduan penggunaan</span>
          </button>
          <div className="local-user">
            <span className="user-avatar">FT</span>
            <div>
              <strong title={access.email}>
                {cloud ? access.email : "Workspace lokal"}
              </strong>
              <small>
                <i />
                {access.role === "admin" ? "Admin" : access.role === "editor" ? "Editor" : "Viewer"} · {access.scopeLabel}
              </small>
            </div>
          </div>
          {cloud && <LogoutButton />}
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Buka navigasi"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{label}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-badge">
              <i />
              {cloud ? "Mode online" : "Mode lokal"}
            </span>
            <span className="topbar-divider" />
            <span className="top-avatar">FT</span>
          </div>
        </header>
        <main className="main-content">
          <div className="page-utility">
            <span className="page-overline">
              {page === "dashboard" ? "OVERVIEW" : label?.toUpperCase()}
              <span className="utility-line" />
            </span>
            <span className="today-label">
              <CalendarDays size={14} />
              {new Intl.DateTimeFormat("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(new Date())}
            </span>
          </div>
          {loadError && (
            <div role="alert" className="notice error">
              {loadError}
              <button
                className="text-button"
                onClick={() => void reload().catch(() => {})}
              >
                Coba lagi
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-state">
              <LoaderCircle className="spin" size={30} />
              <p>Membuka ruang kerja…</p>
            </div>
          ) : (
            <>
              {page === "dashboard" ? (
                <Dashboard
                  rows={rows}
                  onAdd={() => setForm(null)}
                  onEdit={setForm}
                  onNavigate={navigate}
                  onSample={sample}
                  busy={busy}
                  canWrite={canWrite}
                />
              ) : (
                <>
                  <div className="page-heading">
                    <div>
                      <h1>{TITLES[page].title}</h1>
                      <p>{TITLES[page].description}</p>
                    </div>
                    {canWrite && page !== "guide" && page !== "report" && page !== "members" && page !== "organization" && (
                      <button
                        className="button primary"
                        onClick={() => setForm(null)}
                      >
                        <Plus size={17} />
                        Tambah konten
                      </button>
                    )}
                  </div>
                  {(page === "content" || page === "archive") && (
                    <section className="panel">
                      <div className="panel-heading list-heading">
                        <div className="list-title">
                          <h2>
                            {page === "archive"
                              ? "Konten dibatalkan"
                              : "Semua rencana"}{" "}
                            <span className="count">{filtered.length}</span>
                          </h2>
                        </div>
                        <div className="toolbar-actions">
                          <button
                            className="button secondary small"
                            disabled={busy || !filtered.length}
                            onClick={() => void excel()}
                          >
                            <ArrowDownToLine size={15} />
                            Ekspor Excel
                          </button>
                          {canWrite && page === "content" && (
                            <button
                              className="button secondary small"
                              onClick={() => setImportOpen(true)}
                            >
                              <Upload size={15} />
                              Impor Excel
                            </button>
                          )}
                        </div>
                      </div>
                      <FilterBar
                        filters={filters}
                        setFilters={setFilters}
                        rows={base}
                        archive={page === "archive"}
                      />
                      <ContentTable
                        rows={filtered}
                        onEdit={canWrite ? setForm : undefined}
                        onDelete={canWrite ? setDeleting : undefined}
                        onCalendarRetry={canWrite && cloud ? retryCalendar : undefined}
                        emptyAction={
                          canWrite && page === "content" ? (
                            <button
                              className="button primary"
                              onClick={() => setForm(null)}
                            >
                              <Plus size={16} />
                              Tambah konten
                            </button>
                          ) : undefined
                        }
                      />
                      <div className="panel-foot">
                        <span>
                          Menampilkan {filtered.length} dari {base.length}{" "}
                          konten
                        </span>
                        <span>
                          {page === "archive"
                            ? "Edit status menjadi Draf untuk melanjutkan ide."
                            : "Draf → Terbit. Tanpa alur persetujuan."}
                        </span>
                      </div>
                    </section>
                  )}
                  {page === "calendar" && (
                    <>
                      <div className="panel calendar-filters">
                        <FilterBar
                          filters={filters}
                          setFilters={setFilters}
                          rows={active}
                        />
                      </div>
                      <Calendar rows={filtered} onEdit={canWrite ? setForm : undefined} />
                    </>
                  )}
                  {page === "report" && (
                    <>
                      <section className="panel report-filter">
                        <FilterBar
                          filters={filters}
                          setFilters={setFilters}
                          rows={rows}
                          allStatuses
                        />
                      </section>
                      <Report
                        rows={filtered}
                        onExcel={() => void excel()}
                        busy={busy}
                      />
                    </>
                  )}
                  {page === "guide" && <Guide cloud={cloud} />}
                  {page === "members" && access.capabilities.canManageMembers && <MemberManager />}
                  {page === "organization" && access.capabilities.canManageOrganization && <OrganizationManager />}
                </>
              )}
              <footer className="app-footer">
                <span>
                  TAJAM FTI <span>·</span> Ruang untuk ide, langkah untuk
                  cerita.
                </span>
                <span>Tangkap. Arahkan. Jadwalkan. Aksi. Muat.</span>
              </footer>
            </>
          )}
        </main>
      </div>
      {form !== undefined && (
        <ContentForm
          record={form}
          onClose={() => setForm(undefined)}
          onSave={save}
          studyPrograms={access.studyPrograms.filter((x) => x.active).map((x) => x.name)}
        />
      )}
      {importOpen && (
        <ImportDialog
          rows={rows}
          onClose={() => setImportOpen(false)}
          onImport={importRows}
          onTemplate={() => void excel(true)}
        />
      )}
      {deleting && (
        <Dialog
          title="Hapus konten ini?"
          subtitle="Data yang dihapus tidak dapat dikembalikan."
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <div className="modal-body">
            <p className="delete-title">{deleting.idea}</p>
            <p className="muted">
              Jika hanya tidak jadi dipublikasikan, kamu dapat mengubah
              statusnya menjadi Batal agar tetap tersimpan di arsip.
            </p>
          </div>
          <footer className="modal-footer">
            <button
              className="button secondary"
              onClick={() => setDeleting(null)}
              disabled={busy}
            >
              Kembali
            </button>
            <button className="button danger" disabled={busy} onClick={remove}>
              {busy ? "Menghapus…" : "Hapus permanen"}
            </button>
          </footer>
        </Dialog>
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "toast-error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <X size={18} /> : <Check size={18} />}
          <span>{toast.text}</span>
          <button aria-label="Tutup notifikasi" onClick={() => setToast(null)}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
