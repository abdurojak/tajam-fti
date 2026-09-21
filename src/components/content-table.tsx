"use client";
import {
  ArrowUpRight,
  Pencil,
  Trash2,
  Search,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";
import {
  CATEGORIES,
  PRODI,
  STATUSES,
  dateLabel,
  type Content,
} from "@/lib/domain";
import { Avatar, Empty, Status } from "./ui";
import type { CalendarContent } from "@/lib/calendar-sync";
import { calendarStatusLabel } from "@/lib/calendar-ui";
export type Filters = {
  search: string;
  prodi: string;
  category: string;
  status: string;
  pic: string;
  month: string;
};
export const DEFAULT_FILTERS: Filters = {
  search: "",
  prodi: "",
  category: "",
  status: "",
  pic: "",
  month: "",
};
export function filterRows(rows: Content[], filters: Filters) {
  const q = filters.search.toLowerCase().trim();
  return rows.filter(
    (r) =>
      (!q ||
        [r.idea, r.activity, r.pic, r.prodi, r.notes].some((v) =>
          v.toLowerCase().includes(q),
        )) &&
      (!filters.prodi || r.prodi === filters.prodi) &&
      (!filters.category || r.category === filters.category) &&
      (!filters.status || r.status === filters.status) &&
      (!filters.pic || r.pic === filters.pic) &&
      (!filters.month || r.uploadDate.startsWith(filters.month)),
  );
}
export function FilterBar({
  filters,
  setFilters,
  rows,
  archive = false,
  allStatuses = false,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  rows: Content[];
  archive?: boolean;
  allStatuses?: boolean;
}) {
  const update = (key: keyof Filters, value: string) =>
    setFilters({ ...filters, [key]: value });
  const active = Object.values(filters).some(Boolean);
  return (
    <div className="filter-area">
      <div className="filter-top">
        <label className="search-box">
          <Search size={17} />
          <input
            placeholder="Cari ide, kegiatan, atau PIC…"
            aria-label="Cari konten"
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
          />
        </label>
        <span className="filter-label">
          <SlidersHorizontal size={16} /> Filter konten
        </span>
      </div>
      <div className="filter-row">
        <select
          aria-label="Filter prodi"
          value={filters.prodi}
          onChange={(e) => update("prodi", e.target.value)}
        >
          <option value="">Semua prodi</option>
          {Array.from(new Set(rows.map((x) => x.prodi))).sort().map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="Filter kategori"
          value={filters.category}
          onChange={(e) => update("category", e.target.value)}
        >
          <option value="">Semua kategori</option>
          {CATEGORIES.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        {!archive && (
          <select
            aria-label="Filter status"
            value={filters.status}
            onChange={(e) => update("status", e.target.value)}
          >
            <option value="">
              {allStatuses ? "Semua status" : "Semua status aktif"}
            </option>
            {STATUSES.filter((s) => allStatuses || s !== "Batal").map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        )}
        <select
          aria-label="Filter PIC"
          value={filters.pic}
          onChange={(e) => update("pic", e.target.value)}
        >
          <option value="">Semua PIC</option>
          {Array.from(new Set(rows.map((x) => x.pic)))
            .sort()
            .map((x) => (
              <option key={x}>{x}</option>
            ))}
        </select>
        <input
          type="month"
          aria-label="Filter bulan upload"
          value={filters.month}
          onChange={(e) => update("month", e.target.value)}
        />
        {active && (
          <button
            className="text-button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
          >
            <RotateCcw size={14} />
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
export default function ContentTable({
  rows,
  onEdit,
  onDelete,
  onCalendarRetry,
  compact = false,
  emptyAction,
}: {
  rows: (Content | CalendarContent)[];
  onEdit?: (r: Content) => void;
  onDelete?: (r: Content) => void;
  onCalendarRetry?: (r: CalendarContent) => void;
  compact?: boolean;
  emptyAction?: React.ReactNode;
}) {
  if (!rows.length)
    return (
      <Empty
        description="Tambahkan konten baru atau sesuaikan filter untuk melihat rencana tim."
        action={emptyAction}
      />
    );
  return (
    <div className="table-scroll">
      <table className={`content-table ${compact ? "compact" : ""}`}>
        <thead>
          <tr>
            <th>Konten & program studi</th>
            <th>Kategori</th>
            <th>Jadwal upload</th>
            <th>Status</th>
            {!compact && <th>PIC</th>}
            <th>
              <span className="sr-only">Tindakan</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                {onEdit ? (
                  <button className="content-title" onClick={() => onEdit(row)}>
                    {row.idea}
                  </button>
                ) : (
                  <strong>{row.idea}</strong>
                )}
                <div className="content-meta">
                  <span
                    className={`prodi-dot prodi-${PRODI.indexOf(row.prodi as (typeof PRODI)[number])}`}
                  />
                  {row.prodi}
                  <span>·</span>
                  {row.channel}
                </div>
              </td>
              <td>
                <span className="category-tag">{row.category}</span>
              </td>
              <td>
                <span className="date-cell">{dateLabel(row.uploadDate)}</span>
                <small className="muted">{row.format}</small>
              </td>
              <td>
                <Status status={row.status} />
                {"calendarSync" in row && row.calendarSync.status !== "disabled" && (
                  <div className={`calendar-sync ${row.calendarSync.status}`} title={row.calendarSync.error ?? undefined}>
                    <span>{calendarStatusLabel(row.calendarSync.status)}</span>
                    {onCalendarRetry && row.calendarSync.status !== "synced" && (
                      <button type="button" onClick={() => onCalendarRetry(row)}>
                        Sinkronkan ulang
                      </button>
                    )}
                  </div>
                )}
              </td>
              {!compact && (
                <td>
                  <Avatar name={row.pic} />
                </td>
              )}
              <td>
                <div className="row-actions">
                  {row.link && (
                    <a
                      className="icon-button"
                      href={row.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Lihat publikasi ${row.idea}`}
                    >
                      <ArrowUpRight size={17} />
                    </a>
                  )}
                  {onEdit && (
                    <button
                      className="icon-button"
                      aria-label={`Edit ${row.idea}`}
                      onClick={() => onEdit(row)}
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      className="icon-button danger-hover"
                      aria-label={`Hapus ${row.idea}`}
                      onClick={() => onDelete(row)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
