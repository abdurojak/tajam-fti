import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  FIELDS,
  fingerprint,
  validateContent,
  type Content,
  type ContentInput,
} from "./domain";
import {
  INITIAL_DEPARTMENTS,
  INITIAL_MEMBERS,
  INITIAL_STUDY_PROGRAMS,
  AuthorizationError,
  assertCanWrite,
  isProgramAllowed,
  normalizeEmail,
  normalizeMember,
  programIdsFor,
  type AccessContext,
  type DepartmentCommand,
  type MemberCommand,
  type MemberRecord,
  type StudyProgramCommand,
  type Department,
  type StudyProgram,
} from "./organization";

export function createStore(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      active INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS study_programs (
      id TEXT PRIMARY KEY, departmentId TEXT NOT NULL REFERENCES departments(id),
      name TEXT NOT NULL COLLATE NOCASE, active INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
      UNIQUE(departmentId,name)
    );
    CREATE TABLE IF NOT EXISTS team_members (
      email TEXT PRIMARY KEY COLLATE NOCASE, role TEXT NOT NULL, scopeType TEXT NOT NULL,
      departmentId TEXT REFERENCES departments(id), studyProgramId TEXT REFERENCES study_programs(id),
      active INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS access_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, actorEmail TEXT NOT NULL, action TEXT NOT NULL,
      entityType TEXT NOT NULL, entityId TEXT NOT NULL, beforeValue TEXT, afterValue TEXT,
      createdAt TEXT NOT NULL
    );
  `);
  const now = new Date().toISOString();
  const seed = db.transaction(() => {
    const department = db.prepare(`INSERT INTO departments(id,name,active,createdAt,updatedAt)
      VALUES(?,?,1,?,?) ON CONFLICT(id) DO NOTHING`);
    for (const row of INITIAL_DEPARTMENTS) department.run(row.id, row.name, now, now);
    const program = db.prepare(`INSERT INTO study_programs(id,departmentId,name,active,createdAt,updatedAt)
      VALUES(?,?,?,1,?,?) ON CONFLICT(id) DO NOTHING`);
    for (const row of INITIAL_STUDY_PROGRAMS)
      program.run(row.id, row.departmentId, row.name, now, now);
    const member = db.prepare(`INSERT INTO team_members(email,role,scopeType,departmentId,studyProgramId,active,createdAt,updatedAt)
      VALUES(?,?,?,?,?,1,?,?) ON CONFLICT(email) DO NOTHING`);
    for (const row of INITIAL_MEMBERS)
      member.run(row.email,row.role,row.scopeType,row.departmentId,row.studyProgramId,now,now);
  });
  seed();
  db.exec(`CREATE TABLE IF NOT EXISTS content (
    id TEXT PRIMARY KEY, payload TEXT NOT NULL, studyProgramId TEXT REFERENCES study_programs(id),
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`);
  const columns = db.prepare("PRAGMA table_info(content)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "studyProgramId"))
    db.exec("ALTER TABLE content ADD COLUMN studyProgramId TEXT REFERENCES study_programs(id)");
  db.transaction(() => {
    const legacy = db.prepare("SELECT id,payload FROM content WHERE studyProgramId IS NULL").all() as { id: string; payload: string }[];
    const find = db.prepare("SELECT id FROM study_programs WHERE name=? COLLATE NOCASE");
    const update = db.prepare("UPDATE content SET studyProgramId=? WHERE id=?");
    for (const row of legacy) {
      const prodi = JSON.parse(row.payload).prodi;
      const matches = find.all(prodi) as { id: string }[];
      if (matches.length !== 1)
        throw new Error(`Migrasi dibatalkan: prodi ${String(prodi)} tidak dikenal atau ambigu.`);
      update.run(matches[0].id, row.id);
    }
  })();

  const organization = () => ({
    departments: db.prepare("SELECT id,name,active FROM departments ORDER BY name").all().map((row: any) => ({ ...row, active: !!row.active })) as Department[],
    studyPrograms: db.prepare("SELECT id,departmentId,name,active FROM study_programs ORDER BY name").all().map((row: any) => ({ ...row, active: !!row.active })) as StudyProgram[],
  });
  const resolveAccess = (email: string): AccessContext | null => {
    const row = db.prepare("SELECT * FROM team_members WHERE email=? AND active=1").get(normalizeEmail(email)) as any;
    if (!row) return null;
    const scopeId = row.departmentId ?? row.studyProgramId ?? null;
    return {
      email: row.email,
      role: row.role,
      scopeType: row.scopeType,
      scopeId,
      allowedProgramIds: programIdsFor({ role: row.role, scopeType: row.scopeType, scopeId }, organization().studyPrograms),
    };
  };
  const hydrate = (row: any): Content => ({
    ...JSON.parse(row.payload), prodi: row.programName, id: row.id,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  });
  const clean = (input: unknown) => {
    const result = validateContent(input);
    if (Object.keys(result.errors).length) throw new Error(Object.values(result.errors).join(" "));
    return result.data;
  };
  const resolveProgram = (name: string, access: AccessContext) => {
    const rows = db.prepare(`SELECT p.id,p.departmentId,p.name,p.active,d.active AS departmentActive
      FROM study_programs p JOIN departments d ON d.id=p.departmentId
      WHERE p.name=? COLLATE NOCASE`).all(name) as any[];
    if (rows.length !== 1) throw new Error("Program studi tidak ditemukan.");
    if (!rows[0].active || !rows[0].departmentActive)
      throw new Error("Program studi atau jurusannya sudah dinonaktifkan.");
    if (!isProgramAllowed(access, rows[0].id)) throw new AuthorizationError("Program studi berada di luar cakupan Anda.");
    return rows[0];
  };
  const list = (access: AccessContext) => {
    const base = `SELECT c.*,p.name AS programName FROM content c JOIN study_programs p ON p.id=c.studyProgramId`;
    if (access.allowedProgramIds === null)
      return db.prepare(`${base} ORDER BY c.createdAt DESC,c.id`).all().map(hydrate);
    if (!access.allowedProgramIds.length) return [];
    const marks = access.allowedProgramIds.map(() => "?").join(",");
    return db.prepare(`${base} WHERE c.studyProgramId IN (${marks}) ORDER BY c.createdAt DESC,c.id`).all(...access.allowedProgramIds).map(hydrate);
  };
  const insert = (data: ContentInput, access: AccessContext) => {
    const program = resolveProgram(data.prodi, access);
    const id = randomUUID();
    const time = new Date().toISOString();
    db.prepare("INSERT INTO content(id,payload,studyProgramId,createdAt,updatedAt) VALUES(?,?,?,?,?)")
      .run(id, JSON.stringify(data), program.id, time, time);
    return { ...data, prodi: program.name, id, createdAt: time, updatedAt: time };
  };
  const requireAdmin = (access: AccessContext) => {
    if (access.role !== "admin") throw new AuthorizationError();
  };
  const slug = (name: string) =>
    name
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const audit = (
    actor: AccessContext,
    action: string,
    entityType: string,
    entityId: string,
    beforeValue: unknown,
    afterValue: unknown,
  ) =>
    db.prepare(`INSERT INTO access_audit_log
      (actorEmail,action,entityType,entityId,beforeValue,afterValue,createdAt)
      VALUES(?,?,?,?,?,?,?)`).run(
      actor.email,
      action,
      entityType,
      entityId,
      beforeValue == null ? null : JSON.stringify(beforeValue),
      afterValue == null ? null : JSON.stringify(afterValue),
      new Date().toISOString(),
    );
  return {
    organization,
    resolveAccess,
    list,
    create(input: unknown, access: AccessContext) {
      assertCanWrite(access);
      return insert(clean(input), access);
    },
    update(id: string, input: unknown, access: AccessContext) {
      assertCanWrite(access);
      const existing = db.prepare("SELECT studyProgramId FROM content WHERE id=?").get(id) as any;
      if (!existing) return null;
      if (!isProgramAllowed(access, existing.studyProgramId)) throw new AuthorizationError();
      const data = clean(input);
      const program = resolveProgram(data.prodi, access);
      const time = new Date().toISOString();
      db.prepare("UPDATE content SET payload=?,studyProgramId=?,updatedAt=? WHERE id=?")
        .run(JSON.stringify(data), program.id, time, id);
      return hydrate(db.prepare(`SELECT c.*,p.name AS programName FROM content c JOIN study_programs p ON p.id=c.studyProgramId WHERE c.id=?`).get(id));
    },
    remove(id: string, access: AccessContext) {
      assertCanWrite(access);
      const existing = db.prepare("SELECT studyProgramId FROM content WHERE id=?").get(id) as any;
      if (!existing) return false;
      if (!isProgramAllowed(access, existing.studyProgramId)) throw new AuthorizationError();
      return db.prepare("DELETE FROM content WHERE id=?").run(id).changes > 0;
    },
    import(inputs: unknown[], access: AccessContext) {
      assertCanWrite(access);
      const rows = inputs.map(clean);
      return db.transaction(() => {
        for (const row of rows) resolveProgram(row.prodi, access);
        const seen = new Set(list(access).map(fingerprint));
        let added = 0, skipped = 0;
        for (const data of rows) {
          const value = fingerprint(data);
          if (seen.has(value)) { skipped++; continue; }
          insert(data, access); seen.add(value); added++;
        }
        return { added, skipped };
      })();
    },
    listAdministration(access: AccessContext) {
      requireAdmin(access);
      const members = db.prepare(`SELECT email,role,scopeType,departmentId,studyProgramId,active
        FROM team_members ORDER BY email`).all().map((row: any) => ({ ...row, active: !!row.active })) as MemberRecord[];
      const logs = db.prepare(`SELECT id,actorEmail,action,entityType,entityId,beforeValue,afterValue,createdAt
        FROM access_audit_log ORDER BY id DESC LIMIT 100`).all().map((row: any) => ({
          ...row,
          beforeValue: row.beforeValue ? JSON.parse(row.beforeValue) : null,
          afterValue: row.afterValue ? JSON.parse(row.afterValue) : null,
        }));
      return { ...organization(), members, audit: logs };
    },
    saveDepartment(command: DepartmentCommand, access: AccessContext) {
      requireAdmin(access);
      const value = { ...command, name: command.name.trim() };
      if (!value.name) throw new Error("Nama jurusan wajib diisi.");
      return db.transaction(() => {
        const id = value.id ?? slug(value.name);
        const before = db.prepare("SELECT id,name,active FROM departments WHERE id=?").get(id) as any;
        const time = new Date().toISOString();
        if (before)
          db.prepare("UPDATE departments SET name=?,active=?,updatedAt=? WHERE id=?").run(value.name, value.active ? 1 : 0, time, id);
        else
          db.prepare("INSERT INTO departments(id,name,active,createdAt,updatedAt) VALUES(?,?,?,?,?)").run(id, value.name, value.active ? 1 : 0, time, time);
        const after = db.prepare("SELECT id,name,active FROM departments WHERE id=?").get(id) as any;
        after.active = !!after.active;
        audit(access, before ? "update" : "create", "department", id, before ?? null, after);
        return after as Department;
      })();
    },
    saveStudyProgram(command: StudyProgramCommand, access: AccessContext) {
      requireAdmin(access);
      const value = { ...command, name: command.name.trim() };
      if (!value.name) throw new Error("Nama prodi wajib diisi.");
      const department = db.prepare("SELECT active FROM departments WHERE id=?").get(value.departmentId) as any;
      if (!department?.active) throw new Error("Jurusan tujuan tidak aktif.");
      return db.transaction(() => {
        const id = value.id ?? slug(value.name);
        const before = db.prepare("SELECT id,departmentId,name,active FROM study_programs WHERE id=?").get(id) as any;
        const time = new Date().toISOString();
        if (before)
          db.prepare("UPDATE study_programs SET departmentId=?,name=?,active=?,updatedAt=? WHERE id=?").run(value.departmentId, value.name, value.active ? 1 : 0, time, id);
        else
          db.prepare("INSERT INTO study_programs(id,departmentId,name,active,createdAt,updatedAt) VALUES(?,?,?,?,?,?)").run(id, value.departmentId, value.name, value.active ? 1 : 0, time, time);
        const after = db.prepare("SELECT id,departmentId,name,active FROM study_programs WHERE id=?").get(id) as any;
        after.active = !!after.active;
        audit(access, before ? "update" : "create", "study_program", id, before ?? null, after);
        return after as StudyProgram;
      })();
    },
    saveMember(command: MemberCommand, access: AccessContext) {
      requireAdmin(access);
      const value = normalizeMember(command);
      if (value.departmentId) {
        const target = db.prepare("SELECT active FROM departments WHERE id=?").get(value.departmentId) as any;
        if (!target?.active) throw new Error("Jurusan cakupan tidak aktif.");
      }
      if (value.studyProgramId) {
        const target = db.prepare("SELECT active FROM study_programs WHERE id=?").get(value.studyProgramId) as any;
        if (!target?.active) throw new Error("Prodi cakupan tidak aktif.");
      }
      return db.transaction(() => {
        const before = db.prepare("SELECT email,role,scopeType,departmentId,studyProgramId,active FROM team_members WHERE email=?").get(value.email) as any;
        const activeAdmins = (db.prepare("SELECT count(*) AS count FROM team_members WHERE role='admin' AND active=1").get() as any).count as number;
        if (before?.role === "admin" && before.active && (!value.active || value.role !== "admin") && activeAdmins <= 1)
          throw new Error("Aplikasi harus memiliki minimal satu Admin aktif.");
        const time = new Date().toISOString();
        db.prepare(`INSERT INTO team_members(email,role,scopeType,departmentId,studyProgramId,active,createdAt,updatedAt)
          VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET role=excluded.role,scopeType=excluded.scopeType,
          departmentId=excluded.departmentId,studyProgramId=excluded.studyProgramId,active=excluded.active,updatedAt=excluded.updatedAt`)
          .run(value.email,value.role,value.scopeType,value.departmentId,value.studyProgramId,value.active ? 1 : 0,time,time);
        const after = db.prepare("SELECT email,role,scopeType,departmentId,studyProgramId,active FROM team_members WHERE email=?").get(value.email) as any;
        after.active = !!after.active;
        audit(access, before ? "update" : "create", "member", value.email, before ?? null, after);
        return after as MemberRecord;
      })();
    },
    close: () => db.close(),
  };
}

type Store = ReturnType<typeof createStore>;
const globalStore = globalThis as typeof globalThis & { tajamStore?: Store };
export function getStore() {
  return (globalStore.tajamStore ??= createStore(
    process.env.TAJAM_DB_PATH || join(process.cwd(), "data", "tajam.db"),
  ));
}
