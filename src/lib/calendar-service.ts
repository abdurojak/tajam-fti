import { buildCalendarEvent, type CalendarJob } from "./calendar-sync";
import type { CalendarCredentials } from "./auth";
import { getDatabase } from "./database";
import { createGoogleCalendarClient } from "./google-calendar";
import type { AccessContext } from "./organization";

type CalendarPort = ReturnType<typeof createGoogleCalendarClient>;
type StorePort = {
  assignCalendarTarget(id: string, calendarId: string): Promise<string>;
  markCalendarSynced(id: string, action: "upsert" | "delete"): Promise<void>;
  markCalendarFailed(id: string, message: string, retryable: boolean): Promise<void>;
};

export type CalendarSyncResult = {
  id: string;
  status: "pending" | "synced" | "failed";
  error: string | null;
};

export async function syncCalendarJob(
  job: CalendarJob,
  credentials: CalendarCredentials,
  dependencies: { store: StorePort; calendar: CalendarPort },
): Promise<CalendarSyncResult> {
  const configured = process.env.GOOGLE_CALENDAR_ID?.trim() || null;
  let target = job.calendarId;
  if (!target && configured)
    target = await dependencies.store.assignCalendarTarget(job.contentId, configured);
  if (!target) {
    const message = "Google Calendar belum dikonfigurasi.";
    await dependencies.store.markCalendarFailed(job.contentId, message, false);
    return { id: job.contentId, status: "failed", error: message };
  }
  try {
    const content = job.content;
    const deleting = job.desiredAction === "delete" || !content || content.status === "Batal";
    if (deleting)
      await dependencies.calendar.deleteEvent(target, job.googleEventId, credentials.accessToken);
    else
      await dependencies.calendar.upsertEvent(target, buildCalendarEvent(content), credentials.accessToken);
    await dependencies.store.markCalendarSynced(job.contentId, deleting ? "delete" : "upsert");
    return { id: job.contentId, status: "synced", error: null };
  } catch (error) {
    const value = error as { safeMessage?: unknown; retryable?: unknown };
    const message = typeof value.safeMessage === "string"
      ? value.safeMessage
      : "Google Calendar belum dapat disinkronkan.";
    const retryable = value.retryable === true;
    await dependencies.store.markCalendarFailed(job.contentId, message, retryable);
    return { id: job.contentId, status: retryable ? "pending" : "failed", error: message };
  }
}

export async function syncCalendarJobs(options: {
  ids: string[];
  limit?: number;
  access: AccessContext;
  credentials: CalendarCredentials;
}) {
  const store = await getDatabase();
  const ids = Array.from(new Set(options.ids.filter((id) => typeof id === "string" && id.trim())));
  const jobs = await store.listCalendarJobs(ids, Math.min(Math.max(options.limit ?? 20, 1), 20), options.access);
  const calendar = createGoogleCalendarClient();
  const results: CalendarSyncResult[] = [];
  for (const job of jobs)
    results.push(await syncCalendarJob(job, options.credentials, { store, calendar }));
  return {
    processed: results.length,
    synced: results.filter((item) => item.status === "synced").map((item) => item.id),
    failed: results.filter((item) => item.status !== "synced"),
    results,
  };
}
