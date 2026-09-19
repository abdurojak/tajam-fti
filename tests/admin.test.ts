import { afterEach, describe, expect, it } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createStore } from "../src/lib/store";
import { localAdminAccess, type AccessContext } from "../src/lib/organization";

const admin = localAdminAccess();
const databasePath = join(process.cwd(), "data", "organization-restart-test.db");

afterEach(() => {
  for (const suffix of ["", "-shm", "-wal"])
    if (existsSync(databasePath + suffix)) rmSync(databasePath + suffix);
});
const viewer: AccessContext = {
  email: "viewer@trisakti.ac.id",
  role: "viewer",
  scopeType: "study_program",
  scopeId: "sistem-informasi",
  allowedProgramIds: ["sistem-informasi"],
};

describe("organization administration", () => {
  it("creates units and writes audit records", () => {
    const store = createStore(":memory:");
    const department = store.saveDepartment(
      { name: "Jurusan Baru", active: true },
      admin,
    );
    const program = store.saveStudyProgram(
      {
        departmentId: department.id,
        name: "Prodi Baru",
        active: true,
      },
      admin,
    );
    const data = store.listAdministration(admin);
    expect(data.departments).toContainEqual(department);
    expect(data.studyPrograms).toContainEqual(program);
    expect(data.audit.map((x) => x.entityType)).toEqual(
      expect.arrayContaining(["department", "study_program"]),
    );
    store.close();
  });

  it("rejects non-admin management and inactive assignment targets", () => {
    const store = createStore(":memory:");
    expect(() => store.listAdministration(viewer)).toThrow();
    store.saveStudyProgram(
      {
        id: "sistem-informasi",
        departmentId: "teknik-informatika",
        name: "Sistem Informasi",
        active: false,
      },
      admin,
    );
    expect(() =>
      store.saveMember(
        {
          email: "new@trisakti.ac.id",
          role: "editor",
          scopeType: "study_program",
          studyProgramId: "sistem-informasi",
          active: true,
        },
        admin,
      ),
    ).toThrow("tidak aktif");
    store.close();
  });

  it("never permits removal of the final active Admin", () => {
    const store = createStore(":memory:");
    store.saveMember(
      {
        email: "iwan.purwanto@trisakti.ac.id",
        role: "admin",
        active: false,
      },
      admin,
    );
    expect(() =>
      store.saveMember(
        {
          email: "labtif.fti@trisakti.ac.id",
          role: "viewer",
          scopeType: "department",
          departmentId: "teknik-informatika",
          active: true,
        },
        admin,
      ),
    ).toThrow("minimal satu Admin aktif");
    store.close();
  });

  it("preserves Admin changes when the local database is reopened", () => {
    const store = createStore(databasePath);
    store.saveDepartment(
      {
        id: "teknik-informatika",
        name: "Jurusan Informatika",
        active: true,
      },
      admin,
    );
    store.close();

    const reopened = createStore(databasePath);
    expect(
      reopened
        .listAdministration(admin)
        .departments.find((item) => item.id === "teknik-informatika")?.name,
    ).toBe("Jurusan Informatika");
    reopened.close();
  });
});
