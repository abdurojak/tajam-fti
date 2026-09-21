import { describe, expect, it, vi } from "vitest";
import {
  CalendarSyncError,
  createGoogleCalendarClient,
  refreshGoogleAccessToken,
} from "../src/lib/google-calendar";
import { buildCalendarEvent } from "../src/lib/calendar-sync";
import { valid } from "./fixtures";

const event = buildCalendarEvent({
  ...valid,
  id: "550e8400-e29b-41d4-a716-446655440000",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
});

describe("Google Calendar client", () => {
  it("refreshes an access token with the server credentials", async () => {
    const fetch = vi.fn(async () => Response.json({ access_token: "new", expires_in: 3600 }));
    await expect(refreshGoogleAccessToken("refresh", {
      clientId: "client", clientSecret: "secret", fetch,
    })).resolves.toMatchObject({ accessToken: "new" });
    expect(fetch).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("updates first and inserts when the deterministic event is missing", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(Response.json({ id: event.id }, { status: 200 }));
    await createGoogleCalendarClient({ fetch }).upsertEvent("team id", event, "token");
    expect(fetch.mock.calls[0][0]).toContain(`/events/${event.id}`);
    expect(fetch.mock.calls[1][0]).toContain("calendars/team%20id/events");
  });

  it("treats a missing delete as success and classifies permission failures", async () => {
    const missing = vi.fn(async () => new Response("", { status: 404 }));
    await expect(createGoogleCalendarClient({ fetch: missing }).deleteEvent("team", event.id, "token"))
      .resolves.toBeUndefined();
    const denied = vi.fn(async () => Response.json({ error: { message: "raw" } }, { status: 403 }));
    await expect(createGoogleCalendarClient({ fetch: denied }).upsertEvent("team", event, "token"))
      .rejects.toMatchObject({ retryable: false } satisfies Partial<CalendarSyncError>);
  });

  it("reports a safe HTTP code and Google reason for rejected events", async () => {
    const rejected = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(Response.json({ error: {
        message: "private diagnostic text",
        errors: [{ reason: "invalid" }],
      } }, { status: 400 }));
    await expect(createGoogleCalendarClient({ fetch: rejected }).upsertEvent("team", event, "token"))
      .rejects.toMatchObject({
        safeMessage: "Google Calendar menolak agenda (HTTP 400; alasan: invalid).",
        status: 400,
      });
  });
  it("reports the HTTP code for other Google rejections", async () => {
    const rejected = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(new Response("", { status: 422 }));
    await expect(createGoogleCalendarClient({ fetch: rejected }).upsertEvent("team", event, "token"))
      .rejects.toMatchObject({ safeMessage: "Google Calendar belum dapat disinkronkan (HTTP 422)." });
  });
});
