"use client";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  CalendarDays,
} from "lucide-react";
import { type Content, today, dateLabel } from "@/lib/domain";
import { downloadICS } from "@/lib/download";
export default function Calendar({
  rows,
  onEdit,
}: {
  rows: Content[];
  onEdit?: (r: Content) => void;
}) {
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [kind, setKind] = useState("all");
  const [year, num] = month.split("-").map(Number);
  const first = new Date(year, num - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, num, 0).getDate();
  const cells = Array.from(
    { length: Math.ceil((days + offset) / 7) * 7 },
    (_, i) => {
      const date = new Date(year, num - 1, i - offset + 1);
      return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
        number: date.getDate(),
        outside: date.getMonth() !== num - 1,
      };
    },
  );
  const move = (direction: number) => {
    const next = new Date(year, num - 1 + direction, 1);
    setMonth(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`,
    );
  };
  const active = rows.filter((r) => r.status !== "Batal");
  const monthRows = active.filter(
    (r) => r.eventDate.startsWith(month) || r.uploadDate.startsWith(month),
  );
  return (
    <section className="panel calendar-panel">
      <div className="calendar-toolbar">
        <div className="month-switch">
          <button
            aria-label="Bulan sebelumnya"
            className="icon-button"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={20} />
          </button>
          <h2>
            {new Intl.DateTimeFormat("id-ID", {
              month: "long",
              year: "numeric",
            }).format(first)}
          </h2>
          <button
            aria-label="Bulan berikutnya"
            className="icon-button"
            onClick={() => move(1)}
          >
            <ChevronRight size={20} />
          </button>
          <button
            className="button secondary small"
            onClick={() => setMonth(today().slice(0, 7))}
          >
            Hari ini
          </button>
        </div>
        <div className="calendar-tools">
          <select
            aria-label="Jenis jadwal"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="all">Semua jadwal</option>
            <option value="event">Acara</option>
            <option value="upload">Upload</option>
          </select>
          <button
            className="button secondary small"
            disabled={!monthRows.length}
            onClick={() => downloadICS(monthRows, { kind, month })}
          >
            <Download size={15} />
            Ekspor .ics
          </button>
        </div>
      </div>
      <div className="calendar-legend">
        <span>
          <i className="event-dot" />
          Tanggal acara
        </span>
        <span>
          <i className="upload-dot" />
          Tanggal upload
        </span>
        <small>Ekspor .ics untuk impor manual ke Google Calendar.</small>
      </div>
      <div className="calendar-scroll">
        <div className="calendar-grid">
          {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
            <div className="weekday" key={d}>
              {d}
            </div>
          ))}
          {cells.map((cell) => {
            const events = active.flatMap((row) => [
              ...(row.eventDate === cell.key && kind !== "upload"
                ? [{ row, type: "event" }]
                : []),
              ...(row.uploadDate === cell.key && kind !== "event"
                ? [{ row, type: "upload" }]
                : []),
            ]);
            return (
              <div
                className={`calendar-cell ${cell.outside ? "outside" : ""}`}
                key={cell.key}
              >
                <span
                  className={`day-number ${cell.key === today() ? "today" : ""}`}
                >
                  {cell.number}
                </span>
                {events.map((event) => (
                  <button
                    key={event.row.id + event.type}
                    className={`calendar-event ${event.type}`}
                    title={`${event.type === "event" ? "Acara" : "Upload"}: ${event.row.idea}`}
                    onClick={() => onEdit?.(event.row)}
                    disabled={!onEdit}
                  >
                    <i />
                    {event.row.idea}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div className="panel-foot">
        <CalendarDays size={15} />
        {monthRows.length} konten memiliki jadwal di bulan ini. Klik agenda
        untuk melihat detail.
      </div>
    </section>
  );
}
