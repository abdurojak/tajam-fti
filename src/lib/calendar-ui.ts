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

export function calendarRetryResult(
  result: { synced: string[]; failed: { id: string; error: string | null }[] },
  id: string,
) {
  const failed = result.failed.find((item) => item.id === id);
  if (failed) return { ok: false, message: failed.error ?? "Sinkronisasi gagal." };
  if (!result.synced.includes(id)) return { ok: false, message: "Agenda belum diproses. Coba lagi." };
  return { ok: true, message: "Google Calendar berhasil disinkronkan." };
}
