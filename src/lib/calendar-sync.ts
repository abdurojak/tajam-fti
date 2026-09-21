import type { Content } from "./domain";

export type CalendarSyncStatus =
  | "pending"
  | "synced"
  | "failed"
  | "disabled";

export type CalendarSyncSummary = {
  status: CalendarSyncStatus;
  error: string | null;
};

export type CalendarContent = Content & {
  calendarSync: CalendarSyncSummary;
};

export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  description: string;
  start: { date: string };
  end: { date: string };
  extendedProperties: { private: { tajamContentId: string } };
};

export function googleEventId(contentId: string) {
  const normalized = contentId.toLowerCase().replace(/[^0-9a-v]/g, "");
  if (!normalized) throw new Error("ID konten tidak valid untuk Google Calendar.");
  return `tajam${normalized}`;
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) throw new Error("Tanggal acara tidak valid.");
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function buildCalendarEvent(content: Content): GoogleCalendarEvent {
  const details = [
    `Prodi: ${content.prodi}`,
    `Kegiatan: ${content.activity}`,
    `Channel: ${content.channel}`,
    `PIC: ${content.pic}`,
    `Format: ${content.format}`,
    `Status: ${content.status}`,
    content.notes ? `Catatan: ${content.notes}` : "",
    content.link ? `Link publikasi: ${content.link}` : "",
    "Dikelola oleh TAJAM FTI.",
  ].filter(Boolean);
  return {
    id: googleEventId(content.id),
    summary: content.idea.trim(),
    description: details.join("\n"),
    start: { date: content.eventDate },
    end: { date: nextDate(content.eventDate) },
    extendedProperties: { private: { tajamContentId: content.id } },
  };
}
