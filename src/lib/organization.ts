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

export function localAdminAccess(): AccessContext {
  return {
    email: "local@tajam.invalid",
    role: "admin",
    scopeType: "global",
    scopeId: null,
    allowedProgramIds: null,
  };
}
