import { describe, expect, it } from "vitest";
import { calendarBatchIds, calendarStatusLabel } from "../src/lib/calendar-ui";

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
});
