import { describe, expect, it } from "vitest";
import {
  validateContent,
  toDateString,
  fingerprint,
  FIELDS,
} from "../src/lib/domain";
import { valid } from "./fixtures";
describe("aturan konten tanpa approval", () => {
  it("menerima tiga status yang disepakati", () => {
    for (const status of ["Draf", "Terbit", "Batal"])
      expect(validateContent({ ...valid, status }).errors).toEqual({});
  });
  it("menolak status approval lama", () =>
    expect(
      validateContent({ ...valid, status: "Disetujui" }).errors.status,
    ).toBeTruthy());
  it("memberi peringatan tanggal sama tanpa memblokir", () => {
    const result = validateContent({ ...valid, uploadDate: valid.eventDate });
    expect(result.errors).toEqual({});
    expect(result.warnings).toHaveLength(1);
  });
  it("menolak tanggal mustahil dan URL javascript", () => {
    const result = validateContent({
      ...valid,
      eventDate: "2026-02-30",
      link: "javascript:alert(1)",
    });
    expect(result.errors.eventDate).toBeTruthy();
    expect(result.errors.link).toBeTruthy();
  });
  it("mewajibkan nama PIC dan ide", () =>
    expect(
      validateContent({ ...valid, pic: " ", idea: "" }).errors,
    ).toMatchObject({ pic: expect.any(String), idea: expect.any(String) }));
  it("membaca tanggal excel dan tanggal Indonesia tanpa pergeseran hari", () => {
    expect(toDateString(46281)).toBe("2026-09-16");
    expect(toDateString("16/09/2026")).toBe("2026-09-16");
    expect(toDateString("2026-02-30")).toBe("");
  });
  it("menerima jam dan pengingat opsional, serta memberi nilai kosong untuk data lama", () => {
    expect(validateContent(valid).data).toMatchObject({
      eventTime: "",
      reminderMinutes: "",
    });
    const result = validateContent({
      ...valid,
      eventTime: "09:30",
      reminderMinutes: "30",
    });
    expect(result.errors).toEqual({});
    expect(result.data).toMatchObject({
      eventTime: "09:30",
      reminderMinutes: "30",
    });
  });
  it("menolak jam/pengingat tidak valid dan pengingat tanpa jam", () => {
    expect(
      validateContent({ ...valid, eventTime: "25:00" }).errors.eventTime,
    ).toBeTruthy();
    expect(
      validateContent({ ...valid, eventTime: "09:00", reminderMinutes: "15" })
        .errors.reminderMinutes,
    ).toBeTruthy();
    expect(
      validateContent({ ...valid, reminderMinutes: "30" }).errors
        .reminderMinutes,
    ).toBeTruthy();
  });
  it("mempertahankan sidik jari data lama tanpa jam agar impor duplikat tetap dikenali", () => {
    expect(fingerprint(validateContent(valid).data)).toBe(
      JSON.stringify(FIELDS.map((key) => valid[key].trim())),
    );
  });
});
