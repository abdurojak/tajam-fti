export const PRODI = [
  "Teknik Informatika",
  "Sistem Informasi",
  "Teknik Elektro",
  "Magister Teknik Elektro",
  "Teknik Industri",
  "Magister Teknik Industri",
  "Doktor Teknik Industri",
  "Teknik Mesin",
  "Magister Teknik Mesin",
  "Program Profesi Insinyur",
] as const;
export const CATEGORIES = [
  "Conversation",
  "Achievement",
  "Moments",
  "People",
  "Useful",
  "Science & Impact",
] as const;
export const STATUSES = ["Draf", "Terbit", "Batal"] as const;
export const FORMATS = [
  "Feed",
  "Carousel",
  "Poster",
  "Story",
  "Reels",
  "TikTok Video",
  "YouTube Video",
  "Photo Recap",
  "Video Recap",
  "Artikel/Website",
] as const;
export const CHANNELS = [
  "Instagram",
  "TikTok",
  "YouTube",
  "Facebook",
  "Website",
  "LinkedIn",
] as const;
export const FIELDS = [
  "prodi",
  "activity",
  "idea",
  "category",
  "status",
  "eventDate",
  "uploadDate",
  "format",
  "channel",
  "pic",
  "link",
  "notes",
] as const;
export type Field = (typeof FIELDS)[number];
export type SchedulingField = "eventTime" | "reminderMinutes";
export type ContentInput = Record<Field, string> &
  Partial<Record<SchedulingField, string>>;
export type Content = ContentInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};
export const LABELS: Record<Field, string> = {
  prodi: "Prodi",
  activity: "Kegiatan/Informasi Awal",
  idea: "Ide Konten",
  category: "Kategori Konten",
  status: "Status Konten",
  eventDate: "Tanggal Acara",
  uploadDate: "Tanggal Upload",
  format: "Format",
  channel: "Channel",
  pic: "PIC",
  link: "Link Publikasi (Opsional)",
  notes: "Catatan (Opsional)",
};
export const EMPTY: ContentInput = {
  prodi: "",
  activity: "",
  idea: "",
  category: "",
  status: "Draf",
  eventDate: "",
  uploadDate: "",
  format: "",
  channel: "",
  pic: "",
  link: "",
  notes: "",
  eventTime: "",
  reminderMinutes: "",
};
export function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value >= "1900-01-01" &&
    value <= "2200-12-31"
  );
}
export function toDateString(value: unknown, date1904 = false): string {
  let text = "";
  if (value instanceof Date && Number.isFinite(value.getTime()))
    text = value.toISOString().slice(0, 10);
  else if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value < 110000
  ) {
    const time =
      Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 30) +
      Math.floor(value) * 86400000;
    text = new Date(time).toISOString().slice(0, 10);
  } else if (typeof value === "string") {
    const s = value.trim();
    const match = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    text = match
      ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`
      : s;
  }
  return isDate(text) ? text : "";
}
export function validateContent(input: unknown) {
  const source = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >;
  const data = Object.fromEntries(
    FIELDS.map((key) => [
      key,
      typeof source[key] === "string" ? (source[key] as string).trim() : "",
    ]),
  ) as ContentInput;
  data.eventTime =
    typeof source.eventTime === "string" ? source.eventTime.trim() : "";
  data.reminderMinutes =
    typeof source.reminderMinutes === "string"
      ? source.reminderMinutes.trim()
      : "";
  const errors: Partial<Record<Field | SchedulingField, string>> = {};
  const warnings: string[] = [];
  for (const field of FIELDS) {
    if (!["link", "notes"].includes(field) && !data[field])
      errors[field] = `${LABELS[field]} wajib diisi.`;
    if (
      data[field].length >
      (["notes", "activity", "idea"].includes(field) ? 4000 : 500)
    )
      errors[field] = `${LABELS[field]} terlalu panjang.`;
  }
  const enums: Partial<Record<Field, readonly string[]>> = {
    category: CATEGORIES,
    status: STATUSES,
    format: FORMATS,
    channel: CHANNELS,
  };
  for (const [key, options] of Object.entries(enums))
    if (data[key as Field] && !options.includes(data[key as Field]))
      errors[key as Field] = `Pilih ${LABELS[key as Field]} yang tersedia.`;
  for (const key of ["eventDate", "uploadDate"] as const)
    if (data[key] && !isDate(data[key]))
      errors[key] = "Tanggal tidak valid (1900–2200).";
  if (data.eventTime && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(data.eventTime))
    errors.eventTime = "Gunakan jam 00:00–23:59.";
  if (
    data.reminderMinutes &&
    !["0", "10", "30", "60"].includes(data.reminderMinutes)
  )
    errors.reminderMinutes = "Pilih pengingat yang tersedia.";
  if (data.reminderMinutes && !data.eventTime)
    errors.reminderMinutes = "Isi jam mulai untuk menggunakan pengingat.";
  if (data.link) {
    try {
      const url = new URL(data.link);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      errors.link = "Gunakan URL lengkap dengan https:// atau http://.";
    }
  }
  if (
    data.eventDate &&
    data.eventDate === data.uploadDate &&
    isDate(data.eventDate)
  )
    warnings.push(
      "Tanggal acara dan tanggal upload sama. Pastikan jadwal ini memang sesuai.",
    );
  return { data, errors, warnings };
}
export function fingerprint(data: ContentInput) {
  const values: string[] = FIELDS.map((key) => data[key].trim());
  if (data.eventTime || data.reminderMinutes)
    values.push(
      data.eventTime?.trim() ?? "",
      data.reminderMinutes?.trim() ?? "",
    );
  return JSON.stringify(values);
}
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function dateLabel(value: string, full = false) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: full ? "long" : "short",
    ...(full ? { year: "numeric" } : {}),
  }).format(new Date(`${value}T12:00:00`));
}
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}
export const SAMPLES: ContentInput[] = [
  {
    prodi: "Teknik Informatika",
    activity: "Kunjungan SMA Wardaya",
    idea: "Recap kunjungan dan pengalaman siswa mengenal Informatika",
    category: "Moments",
    status: "Draf",
    eventDate: "2026-09-16",
    uploadDate: "2026-09-17",
    format: "Reels",
    channel: "Instagram",
    pic: "Ricardo",
    link: "",
    notes: "Contoh dari template. Status disesuaikan menjadi Draf.",
  },
  {
    prodi: "Teknik Elektro",
    activity: "Mahasiswa meraih juara lomba nasional",
    idea: "Sorotan prestasi dan proses persiapan tim",
    category: "Achievement",
    status: "Draf",
    eventDate: "2026-09-20",
    uploadDate: "2026-09-22",
    format: "Carousel",
    channel: "Instagram",
    pic: "PIC Prodi",
    link: "",
    notes: "Contoh pengisian",
  },
  {
    prodi: "Teknik Mesin",
    activity: "Seminar industri otomotif",
    idea: "Poin penting seminar dan insight untuk mahasiswa",
    category: "Useful",
    status: "Draf",
    eventDate: "2026-09-24",
    uploadDate: "2026-09-25",
    format: "Video Recap",
    channel: "TikTok",
    pic: "PIC Prodi",
    link: "",
    notes: "Contoh pengisian",
  },
];
