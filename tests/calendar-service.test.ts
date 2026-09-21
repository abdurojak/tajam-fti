import { describe, expect, it, vi } from "vitest";
import { syncCalendarJob } from "../src/lib/calendar-service";
import { localAdminAccess } from "../src/lib/organization";
import { valid } from "./fixtures";

const content = {
  ...valid,
  id: "550e8400-e29b-41d4-a716-446655440000",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};
const job = {
  contentId: content.id,
  studyProgramId: "teknik-informatika",
  calendarId: "team",
  googleEventId: "tajam550e8400e29b41d4a716446655440000",
  desiredAction: "upsert" as const,
  syncStatus: "pending" as const,
  lastError: null,
  content,
};

describe("calendar synchronization service", () => {
  it("upserts and marks the same job synced", async () => {
    const store = {
      assignCalendarTarget: vi.fn(),
      markCalendarSynced: vi.fn(),
      markCalendarFailed: vi.fn(),
    };
    const calendar = { upsertEvent: vi.fn(), deleteEvent: vi.fn() };
    await expect(syncCalendarJob(job, { accessToken: "token" }, { store, calendar }))
      .resolves.toMatchObject({ id: content.id, status: "synced" });
    expect(calendar.upsertEvent).toHaveBeenCalledWith("team", expect.objectContaining({ id: job.googleEventId }), "token");
    expect(store.markCalendarSynced).toHaveBeenCalledWith(content.id, "upsert");
  });

  it("deletes a tombstone and preserves a safe failure", async () => {
    const store = {
      assignCalendarTarget: vi.fn(),
      markCalendarSynced: vi.fn(),
      markCalendarFailed: vi.fn(),
    };
    const calendar = {
      upsertEvent: vi.fn(),
      deleteEvent: vi.fn().mockRejectedValue(Object.assign(new Error("safe"), { safeMessage: "safe", retryable: true })),
    };
    const result = await syncCalendarJob(
      { ...job, desiredAction: "delete", content: null },
      { accessToken: "token" },
      { store, calendar },
    );
    expect(result).toMatchObject({ status: "pending", error: "safe" });
    expect(store.markCalendarFailed).toHaveBeenCalledWith(content.id, "safe", true);
  });
});
