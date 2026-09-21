import { describe, expect, it } from "vitest";
import { buildCalendarEvent, googleEventId } from "../src/lib/calendar-sync";
import { valid } from "./fixtures";

describe("Google Calendar event mapping", () => {
  it("uses a stable Google-compatible event id", () => {
    expect(googleEventId("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "tajam550e8400e29b41d4a716446655440000",
    );
  });

  it("creates only an all-day event for the activity date", () => {
    const event = buildCalendarEvent({
      ...valid,
      id: "550e8400-e29b-41d4-a716-446655440000",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    });
    expect(event).toMatchObject({
      id: "tajam550e8400e29b41d4a716446655440000",
      summary: valid.idea,
      start: { date: valid.eventDate },
      end: { date: "2026-09-17" },
      extendedProperties: {
        private: {
          tajamContentId: "550e8400-e29b-41d4-a716-446655440000",
        },
      },
    });
    expect(event.description).not.toContain(valid.uploadDate);
  });
});
