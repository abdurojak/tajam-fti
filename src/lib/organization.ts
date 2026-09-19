export type Role = "admin" | "editor" | "viewer";
export type ScopeType = "global" | "department" | "study_program";

export type Department = {
  id: string;
  name: string;
  active: boolean;
};

export type StudyProgram = {
  id: string;
  departmentId: string;
  name: string;
  active: boolean;
};

export type MemberRecord = {
  email: string;
  role: Role;
  scopeType: ScopeType;
  departmentId: string | null;
  studyProgramId: string | null;
  active: boolean;
};

export const INITIAL_DEPARTMENTS: Department[] = [
  { id: "teknik-informatika", name: "Jurusan Teknik Informatika", active: true },
  { id: "teknik-elektro", name: "Jurusan Teknik Elektro", active: true },
  { id: "teknik-industri", name: "Jurusan Teknik Industri", active: true },
  { id: "teknik-mesin", name: "Jurusan Teknik Mesin", active: true },
  { id: "program-profesi-insinyur", name: "Jurusan Program Profesi Insinyur", active: true },
];

export const INITIAL_STUDY_PROGRAMS: StudyProgram[] = [
  { id: "teknik-informatika", departmentId: "teknik-informatika", name: "Teknik Informatika", active: true },
  { id: "sistem-informasi", departmentId: "teknik-informatika", name: "Sistem Informasi", active: true },
  { id: "teknik-elektro", departmentId: "teknik-elektro", name: "Teknik Elektro", active: true },
  { id: "magister-teknik-elektro", departmentId: "teknik-elektro", name: "Magister Teknik Elektro", active: true },
  { id: "teknik-industri", departmentId: "teknik-industri", name: "Teknik Industri", active: true },
  { id: "magister-teknik-industri", departmentId: "teknik-industri", name: "Magister Teknik Industri", active: true },
  { id: "doktor-teknik-industri", departmentId: "teknik-industri", name: "Doktor Teknik Industri", active: true },
  { id: "teknik-mesin", departmentId: "teknik-mesin", name: "Teknik Mesin", active: true },
  { id: "magister-teknik-mesin", departmentId: "teknik-mesin", name: "Magister Teknik Mesin", active: true },
  { id: "program-profesi-insinyur", departmentId: "program-profesi-insinyur", name: "Program Profesi Insinyur", active: true },
];

export const INITIAL_MEMBERS: MemberRecord[] = [
  normalizeMember({ email: "labtif.fti@trisakti.ac.id", role: "admin" }),
  normalizeMember({ email: "iwan.purwanto@trisakti.ac.id", role: "admin" }),
  normalizeMember({ email: "abdurojak@trisakti.ac.id", role: "editor", scopeType: "department", departmentId: "teknik-informatika" }),
  normalizeMember({ email: "ricardo.dharma@trisakti.ac.id", role: "editor", scopeType: "department", departmentId: "teknik-informatika" }),
  normalizeMember({ email: "aszani@trisakti.ac.id", role: "editor", scopeType: "study_program", studyProgramId: "sistem-informasi" }),
  normalizeMember({ email: "rifdah.amelia@trisakti.ac.id", role: "editor", scopeType: "study_program", studyProgramId: "sistem-informasi" }),
  normalizeMember({ email: "tri.swasono@trisakti.ac.id", role: "editor", scopeType: "department", departmentId: "teknik-elektro" }),
  normalizeMember({ email: "thalia.pk@trisakti.ac.id", role: "editor", scopeType: "department", departmentId: "teknik-industri" }),
  normalizeMember({ email: "agus.dwicahyo@trisakti.ac.id", role: "editor", scopeType: "department", departmentId: "teknik-mesin" }),
];

export type AccessContext = {
  email: string;
  role: Role;
  scopeType: ScopeType;
  scopeId: string | null;
  allowedProgramIds: string[] | null;
};

export type Capabilities = {
  canWriteContent: boolean;
  canImport: boolean;
  canExport: boolean;
  canManageOrganization: boolean;
  canManageMembers: boolean;
};

export type AccessSummary = AccessContext & {
  scopeLabel: string;
  capabilities: Capabilities;
  departments: Department[];
  studyPrograms: StudyProgram[];
};

export type DepartmentCommand = { id?: string; name: string; active: boolean };
export type StudyProgramCommand = {
  id?: string;
  departmentId: string;
  name: string;
  active: boolean;
};
export type MemberCommand = {
  email: string;
  role: Role;
  scopeType?: ScopeType;
  departmentId?: string | null;
  studyProgramId?: string | null;
  active: boolean;
};
export type AuditRecord = {
  id: string | number;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeValue: unknown;
  afterValue: unknown;
  createdAt: string;
};
export type AdministrationData = {
  departments: Department[];
  studyPrograms: StudyProgram[];
  members: MemberRecord[];
  audit: AuditRecord[];
};

export function accessSummary(
  access: AccessContext,
  organization: { departments: Department[]; studyPrograms: StudyProgram[] },
): AccessSummary {
  const departments =
    access.role === "admin"
      ? organization.departments
      : access.scopeType === "department"
        ? organization.departments.filter((x) => x.id === access.scopeId)
        : organization.departments.filter((department) =>
            organization.studyPrograms.some(
              (program) =>
                program.id === access.scopeId &&
                program.departmentId === department.id,
            ),
          );
  const studyPrograms = organization.studyPrograms.filter(
    (program) => isProgramAllowed(access, program.id),
  );
  const scopeLabel =
    access.role === "admin"
      ? "Seluruh FTI"
      : access.scopeType === "department"
        ? departments[0]?.name ?? "Jurusan tidak tersedia"
        : studyPrograms[0]?.name ?? "Prodi tidak tersedia";
  return {
    ...access,
    scopeLabel,
    capabilities: capabilitiesFor(access.role),
    departments,
    studyPrograms,
  };
}

export class AuthorizationError extends Error {
  status = 403;
  constructor(message = "Anda tidak memiliki akses untuk tindakan ini.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

type MemberInput = {
  email: string;
  role: Role;
  scopeType?: ScopeType;
  departmentId?: string | null;
  studyProgramId?: string | null;
  active?: boolean;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeMember(input: MemberInput): MemberRecord {
  const email = normalizeEmail(input.email);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Email tidak valid.");
  if (input.role === "admin") {
    return {
      email,
      role: "admin",
      scopeType: "global",
      departmentId: null,
      studyProgramId: null,
      active: input.active ?? true,
    };
  }
  const department =
    input.scopeType === "department" &&
    !!input.departmentId &&
    !input.studyProgramId;
  const studyProgram =
    input.scopeType === "study_program" &&
    !!input.studyProgramId &&
    !input.departmentId;
  if (!department && !studyProgram)
    throw new Error("Pilih satu cakupan jurusan atau prodi.");
  return {
    email,
    role: input.role,
    scopeType: input.scopeType!,
    departmentId: department ? input.departmentId! : null,
    studyProgramId: studyProgram ? input.studyProgramId! : null,
    active: input.active ?? true,
  };
}

export function programIdsFor(
  scope: Pick<AccessContext, "role" | "scopeType" | "scopeId">,
  programs: StudyProgram[],
): string[] | null {
  if (scope.role === "admin") return null;
  if (scope.scopeType === "department")
    return programs
      .filter((program) => program.departmentId === scope.scopeId)
      .map((program) => program.id);
  return scope.scopeId ? [scope.scopeId] : [];
}

export function capabilitiesFor(role: Role): Capabilities {
  return {
    canWriteContent: role !== "viewer",
    canImport: role !== "viewer",
    canExport: true,
    canManageOrganization: role === "admin",
    canManageMembers: role === "admin",
  };
}

export function assertCanWrite(access: AccessContext) {
  if (access.role === "viewer") throw new AuthorizationError();
}

export function isProgramAllowed(
  access: AccessContext,
  studyProgramId: string,
) {
  return (
    access.allowedProgramIds === null ||
    access.allowedProgramIds.includes(studyProgramId)
  );
}

export function localAdminAccess(): AccessContext {
  return {
    email: "local@tajam.invalid",
    role: "admin",
    scopeType: "global",
    scopeId: null,
    allowedProgramIds: null,
  };
}
