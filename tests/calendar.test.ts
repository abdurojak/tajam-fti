import { expect, it } from "vitest";
import { makeICS } from "../src/lib/download";
import { valid } from "./fixtures";
const record = {
  ...valid,
  id: "test-calendar",
  createdAt: "2026-09-01",
  updatedAt: "2026-09-01",
};
it("ekspor hanya jadwal upload pada bulan yang dipilih", () => {
  const result = makeICS([{ ...record, eventDate: "2026-08-31" }], {
    kind: "upload",
    month: "2026-09",
  });
  expect(result).toContain("SUMMARY:Upload:");
  expect(result).not.toContain("SUMMARY:Acara:");
  expect(result).not.toContain("20260831");
});
it("mengecualikan tanggal di luar bulan dan konten Batal", () => {
  const result = makeICS(
    [
      { ...record, eventDate: "2026-08-31" },
      { ...record, id: "cancelled", status: "Batal" },
    ],
    { kind: "all", month: "2026-09" },
  );
  expect(result.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  expect(result).not.toContain("cancelled");
});
