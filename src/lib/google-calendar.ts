import type { GoogleCalendarEvent } from "./calendar-sync";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class CalendarSyncError extends Error {
  constructor(
    public safeMessage: string,
    public retryable: boolean,
    public status?: number,
  ) {
    super(safeMessage);
  }
}

function errorFor(status?: number) {
  if (status === 401)
    return new CalendarSyncError("Izin Google Calendar berakhir. Silakan keluar lalu masuk kembali.", false, status);
  if (status === 403)
    return new CalendarSyncError("Akun Anda belum memiliki izin mengubah kalender tim.", false, status);
  if (status === 404)
    return new CalendarSyncError("Kalender tim tidak ditemukan.", false, status);
  if (status === 429 || (status != null && status >= 500))
    return new CalendarSyncError("Google Calendar sedang sibuk. Coba sinkronkan lagi.", true, status);
  return new CalendarSyncError(
    `Google Calendar belum dapat disinkronkan${status ? ` (HTTP ${status})` : ""}.`,
    true,
    status,
  );
}

async function calendarResponseError(response: Response) {
  if (response.status !== 400) return errorFor(response.status);
  let reason: unknown;
  try {
    const data = await response.json() as { error?: { errors?: { reason?: unknown }[] } };
    reason = data.error?.errors?.[0]?.reason;
  } catch { /* The HTTP code remains useful when Google has no JSON body. */ }
  const safeReason = typeof reason === "string" && /^[A-Za-z0-9_-]{1,60}$/.test(reason)
    ? `; alasan: ${reason}` : "";
  return new CalendarSyncError(`Google Calendar menolak agenda (HTTP 400${safeReason}).`, false, 400);
}

export async function refreshGoogleAccessToken(
  refreshToken: string,
  options: { clientId: string; clientSecret: string; fetch?: FetchLike },
) {
  let response: Response;
  try {
    response = await (options.fetch ?? fetch)("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: options.clientId,
        client_secret: options.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
  } catch {
    throw new CalendarSyncError("Google belum dapat dihubungi. Coba sinkronkan lagi.", true);
  }
  if (!response.ok) throw errorFor(response.status);
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw errorFor();
  return {
    accessToken: data.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
  };
}

export function createGoogleCalendarClient(options: {
  fetch?: FetchLike;
  timeoutMs?: number;
} = {}) {
  const request = options.fetch ?? fetch;
  const base = "https://www.googleapis.com/calendar/v3";
  async function call(url: string, init: RequestInit) {
    try {
      return await request(url, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(options.timeoutMs ?? 8_000),
      });
    } catch {
      throw new CalendarSyncError("Google belum dapat dihubungi. Coba sinkronkan lagi.", true);
    }
  }
  const headers = (token: string) => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });
  return {
    async upsertEvent(calendarId: string, event: GoogleCalendarEvent, token: string) {
      const events = `${base}/calendars/${encodeURIComponent(calendarId)}/events`;
      let response = await call(`${events}/${encodeURIComponent(event.id)}`, {
        method: "PUT",
        headers: headers(token),
        body: JSON.stringify(event),
      });
      if (response.status === 404) {
        response = await call(events, {
          method: "POST",
          headers: headers(token),
          body: JSON.stringify(event),
        });
        if (response.status === 409) {
          response = await call(`${events}/${encodeURIComponent(event.id)}`, {
            method: "PUT",
            headers: headers(token),
            body: JSON.stringify(event),
          });
        }
      }
      if (!response.ok) throw await calendarResponseError(response);
    },
    async deleteEvent(calendarId: string, eventId: string, token: string) {
      const response = await call(
        `${base}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        { method: "DELETE", headers: headers(token) },
      );
      if (response.status !== 404 && !response.ok) throw errorFor(response.status);
    },
  };
}
