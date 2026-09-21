import type { CalendarSyncStatus } from "./calendar-sync";

export function calendarStatusLabel(status: CalendarSyncStatus) {
  return {
    synced: "Tersinkron",
    pending: "Menunggu",
    failed: "Gagal",
    disabled: "Tidak aktif",
  }[status];
}

export function calendarBatchIds(ids: string[], size = 20) {
  const unique = Array.from(new Set(ids));
  const batches: string[][] = [];
  for (let index = 0; index < unique.length; index += size)
    batches.push(unique.slice(index, index + size));
  return batches;
}
