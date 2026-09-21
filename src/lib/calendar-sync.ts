import type { Content } from "./domain";

export type CalendarSyncStatus = "pending" | "synced" | "failed" | "disabled";

export type CalendarSyncSummary = {
  status: CalendarSyncStatus;
  error: string | null;
};

export type CalendarContent = Content & {
  calendarSync: CalendarSyncSummary;
};

export type CalendarJob = {
  contentId: string;
  studyProgramId: string;
  calendarId: string | null;
  googleEventId: string;
  desiredAction: "upsert" | "delete";
  syncStatus: Exclude<CalendarSyncStatus, "disabled">;
  lastError: string | null;
  content: Content | null;
};

export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  description: string;
  start: { date: string } | { dateTime: string; timeZone: "Asia/Jakarta" };
  end: { date: string } | { dateTime: string; timeZone: "Asia/Jakarta" };
  reminders?: {
    useDefault: false;
    overrides: { method: "popup"; minutes: number }[];
  };
  extendedProperties: { private: { tajamContentId: string } };
};

export function googleEventId(contentId: string) {
  const normalized = contentId.toLowerCase().replace(/[^0-9a-v]/g, "");
  if (!normalized)
    throw new Error("ID konten tidak valid untuk Google Calendar.");
  return `tajam${normalized}`;
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Tanggal acara tidak valid.");
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
  const event: GoogleCalendarEvent = {
    id: googleEventId(content.id),
    summary: content.idea.trim(),
    description: details.join("\n"),
    start: { date: content.eventDate },
    end: { date: nextDate(content.eventDate) },
    extendedProperties: { private: { tajamContentId: content.id } },
  };
  if (content.eventTime) {
    const [hour, minute] = content.eventTime.split(":").map(Number);
    const [year, month, day] = content.eventDate.split("-").map(Number);
    const end = new Date(Date.UTC(year, month - 1, day, hour + 1, minute));
    const endDate = end.toISOString().slice(0, 10);
    const endTime = end.toISOString().slice(11, 16);
    event.start = {
      dateTime: `${content.eventDate}T${content.eventTime}:00+07:00`,
      timeZone: "Asia/Jakarta",
    };
    event.end = {
      dateTime: `${endDate}T${endTime}:00+07:00`,
      timeZone: "Asia/Jakarta",
    };
    if (content.reminderMinutes)
      event.reminders = {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: Number(content.reminderMinutes) },
        ],
      };
  }
  return event;
}
