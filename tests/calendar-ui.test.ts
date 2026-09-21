import { describe, expect, it } from "vitest";
import { calendarBatchIds, calendarRetryResult, calendarStatusLabel } from "../src/lib/calendar-ui";

describe("calendar UI helpers", () => {
  it("labels synchronization states", () => {
    expect(calendarStatusLabel("synced")).toBe("Tersinkron");
    expect(calendarStatusLabel("pending")).toBe("Menunggu");
    expect(calendarStatusLabel("failed")).toBe("Gagal");
  });
  it("deduplicates ids into batches of at most twenty", () => {
    const ids = [...Array.from({ length: 25 }, (_, index) => String(index)), "1"];
    expect(calendarBatchIds(ids).map((batch) => batch.length)).toEqual([20, 5]);
  });
  it("does not report success when a retry response contains a failed job", () => {
    expect(calendarRetryResult({ synced: [], failed: [{ id: "one", error: "HTTP 400" }] }, "one"))
      .toEqual({ ok: false, message: "HTTP 400" });
  });
});
