import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("organizational migration", () => {
  const sql = readFileSync("db/002-organizational-access.sql", "utf8");

  it("creates organization, membership, audit, and content scope schema", () => {
    for (const table of [
      "departments",
      "study_programs",
      "team_members",
      "access_audit_log",
    ])
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS study_program_id");
    expect(sql).toContain("ALTER COLUMN study_program_id SET NOT NULL");
  });

  it("seeds the exact hierarchy and initial members", () => {
    for (const value of [
      "Jurusan Teknik Informatika",
      "Sistem Informasi",
      "Magister Teknik Elektro",
      "Doktor Teknik Industri",
      "Program Profesi Insinyur",
      "labtif.fti@trisakti.ac.id",
      "iwan.purwanto@trisakti.ac.id",
      "rifdah.amelia@trisakti.ac.id",
      "agus.dwicahyo@trisakti.ac.id",
    ])
      expect(sql).toContain(value);
  });

  it("aborts when a legacy program cannot be mapped", () => {
    expect(sql).toMatch(/RAISE EXCEPTION[^;]+prodi/si);
    expect(sql.indexOf("RAISE EXCEPTION")).toBeLessThan(
      sql.indexOf("ALTER COLUMN study_program_id SET NOT NULL"),
    );
  });

  it("does not overwrite organization data that an Admin has edited", () => {
    expect(sql).not.toMatch(/ON CONFLICT \([^)]*\) DO UPDATE/);
    expect(sql).toContain("VALUES ('002-organizational-access.sql')");
  });
});
