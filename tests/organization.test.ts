import { describe, expect, it } from "vitest";
import {
  capabilitiesFor,
  localAdminAccess,
  normalizeMember,
  programIdsFor,
  type StudyProgram,
} from "../src/lib/organization";

const programs: StudyProgram[] = [
  {
    id: "teknik-informatika",
    departmentId: "teknik-informatika",
    name: "Teknik Informatika",
    active: true,
  },
  {
    id: "sistem-informasi",
    departmentId: "teknik-informatika",
    name: "Sistem Informasi",
    active: true,
  },
  {
    id: "teknik-elektro",
    departmentId: "teknik-elektro",
    name: "Teknik Elektro",
    active: true,
  },
];

describe("organization authorization", () => {
  it("normalizes an Admin to global scope", () => {
    expect(
      normalizeMember({ email: " ADMIN@Example.com ", role: "admin" }),
    ).toEqual({
      email: "admin@example.com",
      role: "admin",
      scopeType: "global",
      departmentId: null,
      studyProgramId: null,
      active: true,
    });
  });

  it("rejects a non-admin without exactly one matching scope", () => {
    expect(() =>
      normalizeMember({ email: "x@example.com", role: "editor" }),
    ).toThrow("Pilih satu cakupan");
    expect(() =>
      normalizeMember({
        email: "x@example.com",
        role: "viewer",
        scopeType: "department",
        departmentId: "teknik-informatika",
        studyProgramId: "sistem-informasi",
      }),
    ).toThrow("Pilih satu cakupan");
  });

  it("resolves department and study-program scopes", () => {
    expect(
      programIdsFor(
        {
          role: "editor",
          scopeType: "department",
          scopeId: "teknik-informatika",
        },
        programs,
      ),
    ).toEqual(["teknik-informatika", "sistem-informasi"]);
    expect(
      programIdsFor(
        {
          role: "viewer",
          scopeType: "study_program",
          scopeId: "sistem-informasi",
        },
        programs,
      ),
    ).toEqual(["sistem-informasi"]);
  });

  it("gives viewers no mutation capability", () => {
    expect(capabilitiesFor("viewer")).toEqual({
      canWriteContent: false,
      canImport: false,
      canExport: true,
      canManageOrganization: false,
      canManageMembers: false,
    });
  });

  it("uses an implicit global Admin in local mode", () => {
    expect(localAdminAccess()).toMatchObject({
      role: "admin",
      scopeType: "global",
      allowedProgramIds: null,
    });
  });
});
