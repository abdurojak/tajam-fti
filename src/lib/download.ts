import { type Content } from "./domain";
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function escapeICS(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}
function fold(line: string) {
  let result = "",
    bytes = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    if (bytes + size > 73) {
      result += "\r\n ";
      bytes = 1;
    }
    result += char;
    bytes += size;
  }
  return result;
}
export type CalendarExportOptions = { kind?: string; month?: string };
export function makeICS(rows: Content[], options: CalendarExportOptions = {}) {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TAJAM FTI//Planner//ID",
    "CALSCALE:GREGORIAN",
  ];
  for (const row of rows.filter((r) => r.status !== "Batal"))
    for (const [kind, date] of [
      ["Acara", row.eventDate],
      ["Upload", row.uploadDate],
    ]) {
      if (options.kind === "event" && kind !== "Acara") continue;
      if (options.kind === "upload" && kind !== "Upload") continue;
      if (options.month && !date.startsWith(options.month)) continue;
      const next = new Date(`${date}T12:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      lines.push(
        "BEGIN:VEVENT",
        `UID:${row.id}-${kind}@tajam.local`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${date.replaceAll("-", "")}`,
        `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replaceAll("-", "")}`,
        `SUMMARY:${escapeICS(`${kind}: ${row.idea}`)}`,
        `DESCRIPTION:${escapeICS(`${row.prodi} | ${row.channel} | PIC: ${row.pic}\n${row.activity}\n${row.notes}`)}`,
        "END:VEVENT",
      );
    }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
export function downloadICS(
  rows: Content[],
  options: CalendarExportOptions = {},
) {
  downloadBlob(
    new Blob([makeICS(rows, options)], { type: "text/calendar;charset=utf-8" }),
    "TAJAM-FTI-kalender.ics",
  );
}
