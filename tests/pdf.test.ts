import { expect, it } from "vitest";
import { createPDF } from "../src/lib/pdf";
import { valid } from "./fixtures";
it("membuat laporan PDF yang memuat ide, status, PIC dan tanggal", async () => {
  const bytes = await createPDF([
    { ...valid, id: "pdf-test", createdAt: "", updatedAt: "" },
  ]);
  const text = new TextDecoder().decode(bytes);
  expect(text.startsWith("%PDF-")).toBe(true);
  expect(text).toContain("Cerita dari kampus");
  expect(text).toContain("Ricardo");
  expect(text).toContain("Draf");
  expect(text).toContain("2026-09-17");
});
