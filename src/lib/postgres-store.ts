import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import {
  fingerprint,
  validateContent,
  type Content,
  type ContentInput,
} from "./domain";
import {
  AuthorizationError,
  assertCanWrite,
  isProgramAllowed,
  normalizeEmail,
  normalizeMember,
  programIdsFor,
  type AccessContext,
  type Department,
  type DepartmentCommand,
  type MemberCommand,
  type MemberRecord,
  type StudyProgram,
  type StudyProgramCommand,
} from "./organization";

type Row = {
  id: string;
  payload: ContentInput;
  program_name: string;
  created_at: Date;
  updated_at: Date;
};

type ProgramRow = {
  id: string;
  department_id: string;
  name: string;
  active: boolean;
};

function hydrate(row: Row): Content {
  return {
    ...row.payload,
    prodi: row.program_name,
    id: row.id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
function clean(input: unknown) {
  const result = validateContent(input);
  if (Object.keys(result.errors).length)
    throw new Error(Object.values(result.errors).join(" "));
  return result.data;
}
function key(input: ContentInput) {
  return createHash("sha256").update(fingerprint(input)).digest("hex");
}
function mapProgram(row: ProgramRow): StudyProgram {
  return {
    id: row.id,
    departmentId: row.department_id,
    name: row.name,
    active: row.active,
  };
}

export function createPostgresStore(pool: Pool) {
  async function write<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(74201919)");
      const result = await action(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function organization() {
    const [departments, programs] = await Promise.all([
      pool.query<{ id: string; name: string; active: boolean }>(
        "SELECT id,name,active FROM departments ORDER BY name",
      ),
      pool.query<ProgramRow>(
        "SELECT id,department_id,name,active FROM study_programs ORDER BY name",
      ),
    ]);
    return {
      departments: departments.rows as Department[],
      studyPrograms: programs.rows.map(mapProgram),
    };
  }

  async function resolveProgram(
    executor: Pool | PoolClient,
    prodi: string,
    access: AccessContext,
  ) {
    const result = await executor.query<ProgramRow>(
      "SELECT id,department_id,name,active FROM study_programs WHERE lower(name)=lower($1)",
      [prodi],
    );
    if (result.rowCount !== 1) throw new Error("Program studi tidak ditemukan.");
    const program = result.rows[0];
    if (!program.active) throw new Error("Program studi sudah dinonaktifkan.");
    if (!isProgramAllowed(access, program.id))
      throw new AuthorizationError("Program studi berada di luar cakupan Anda.");
    return program;
  }

  const select = `SELECT c.id,c.payload,p.name AS program_name,c.created_at,c.updated_at
    FROM content c JOIN study_programs p ON p.id=c.study_program_id`;

  const requireAdmin = (access: AccessContext) => {
    if (access.role !== "admin") throw new AuthorizationError();
  };
  const slug = (name: string) =>
    name.trim().toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  async function addAudit(
    client: PoolClient,
    actor: AccessContext,
    action: string,
    entityType: string,
    entityId: string,
    beforeValue: unknown,
    afterValue: unknown,
  ) {
    await client.query(
      `INSERT INTO access_audit_log(actor_email,action,entity_type,entity_id,before_value,after_value)
       VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)`,
      [actor.email, action, entityType, entityId, beforeValue == null ? null : JSON.stringify(beforeValue), afterValue == null ? null : JSON.stringify(afterValue)],
    );
  }

  return {
    organization,
    async resolveAccess(email: string): Promise<AccessContext | null> {
      const member = await pool.query<{
        email: string;
        role: AccessContext["role"];
        scope_type: AccessContext["scopeType"];
        department_id: string | null;
        study_program_id: string | null;
      }>(
        `SELECT email,role,scope_type,department_id,study_program_id
         FROM team_members WHERE email=$1 AND active=true`,
        [normalizeEmail(email)],
      );
      if (!member.rows[0]) return null;
      const row = member.rows[0];
      const scopeId = row.department_id ?? row.study_program_id;
      const programs = (await organization()).studyPrograms;
      return {
        email: row.email,
        role: row.role,
        scopeType: row.scope_type,
        scopeId,
        allowedProgramIds: programIdsFor(
          { role: row.role, scopeType: row.scope_type, scopeId },
          programs,
        ),
      };
    },
    async list(access: AccessContext) {
      const result =
        access.allowedProgramIds === null
          ? await pool.query<Row>(`${select} ORDER BY c.created_at DESC,c.id`)
          : await pool.query<Row>(
              `${select} WHERE c.study_program_id=ANY($1::text[]) ORDER BY c.created_at DESC,c.id`,
              [access.allowedProgramIds],
            );
      return result.rows.map(hydrate);
    },
    async create(input: unknown, access: AccessContext) {
      assertCanWrite(access);
      const data = clean(input);
      return write(async (client) => {
        const program = await resolveProgram(client, data.prodi, access);
        const result = await client.query<Row>(
          `INSERT INTO content (id,payload,fingerprint,study_program_id)
           VALUES ($1,$2::jsonb,$3,$4)
           RETURNING id,payload,$5::text AS program_name,created_at,updated_at`,
          [randomUUID(), JSON.stringify(data), key(data), program.id, program.name],
        );
        return hydrate(result.rows[0]);
      });
    },
    async update(id: string, input: unknown, access: AccessContext) {
      assertCanWrite(access);
      const data = clean(input);
      return write(async (client) => {
        const existing = await client.query<{ study_program_id: string }>(
          "SELECT study_program_id FROM content WHERE id=$1 FOR UPDATE",
          [id],
        );
        if (!existing.rows[0]) return null;
        if (!isProgramAllowed(access, existing.rows[0].study_program_id))
          throw new AuthorizationError();
        const program = await resolveProgram(client, data.prodi, access);
        const result = await client.query<Row>(
          `UPDATE content SET payload=$1::jsonb,fingerprint=$2,study_program_id=$3,updated_at=now()
           WHERE id=$4 RETURNING id,payload,$5::text AS program_name,created_at,updated_at`,
          [JSON.stringify(data), key(data), program.id, id, program.name],
        );
        return result.rows[0] ? hydrate(result.rows[0]) : null;
      });
    },
    async remove(id: string, access: AccessContext) {
      assertCanWrite(access);
      return write(async (client) => {
        const row = await client.query<{ study_program_id: string }>(
          "SELECT study_program_id FROM content WHERE id=$1 FOR UPDATE",
          [id],
        );
        if (!row.rows[0]) return false;
        if (!isProgramAllowed(access, row.rows[0].study_program_id))
          throw new AuthorizationError();
        return (await client.query("DELETE FROM content WHERE id=$1", [id])).rowCount !== 0;
      });
    },
    async import(inputs: unknown[], access: AccessContext) {
      assertCanWrite(access);
      const data = inputs.map(clean);
      return write(async (client) => {
        const programs = new Map<string, ProgramRow>();
        for (const payload of data) {
          const program = await resolveProgram(client, payload.prodi, access);
          programs.set(payload.prodi.toLowerCase(), program);
        }
        const unique = new Map(data.map((payload) => [key(payload), payload]));
        const batch = Array.from(unique, ([fingerprint, payload]) => ({
          id: randomUUID(),
          fingerprint,
          payload,
          studyProgramId: programs.get(payload.prodi.toLowerCase())!.id,
        }));
        const result = await client.query(
          `INSERT INTO content (id,fingerprint,payload,study_program_id)
           SELECT row.id,row.fingerprint,row.payload,row.study_program_id
           FROM jsonb_to_recordset($1::jsonb)
             AS row(id text,fingerprint text,payload jsonb,study_program_id text)
           WHERE NOT EXISTS (SELECT 1 FROM content WHERE content.fingerprint=row.fingerprint)`,
          [JSON.stringify(batch.map((x) => ({ ...x, study_program_id: x.studyProgramId })))],
        );
        const added = result.rowCount ?? 0;
        return { added, skipped: inputs.length - added };
      });
    },
    async listAdministration(access: AccessContext) {
      requireAdmin(access);
      const [org, members, audit] = await Promise.all([
        organization(),
        pool.query(`SELECT email,role,scope_type AS "scopeType",department_id AS "departmentId",
          study_program_id AS "studyProgramId",active FROM team_members ORDER BY email`),
        pool.query(`SELECT id,actor_email AS "actorEmail",action,entity_type AS "entityType",
          entity_id AS "entityId",before_value AS "beforeValue",after_value AS "afterValue",
          created_at AS "createdAt" FROM access_audit_log ORDER BY id DESC LIMIT 100`),
      ]);
      return { ...org, members: members.rows as MemberRecord[], audit: audit.rows };
    },
    async saveDepartment(command: DepartmentCommand, access: AccessContext) {
      requireAdmin(access);
      const name = command.name.trim();
      if (!name) throw new Error("Nama jurusan wajib diisi.");
      return write(async (client) => {
        const id = command.id ?? slug(name);
        const before = (await client.query("SELECT id,name,active FROM departments WHERE id=$1 FOR UPDATE", [id])).rows[0] ?? null;
        const result = await client.query<Department>(
          `INSERT INTO departments(id,name,active) VALUES($1,$2,$3)
           ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,active=EXCLUDED.active,updated_at=now()
           RETURNING id,name,active`,
          [id, name, command.active],
        );
        await addAudit(client, access, before ? "update" : "create", "department", id, before, result.rows[0]);
        return result.rows[0];
      });
    },
    async saveStudyProgram(command: StudyProgramCommand, access: AccessContext) {
      requireAdmin(access);
      const name = command.name.trim();
      if (!name) throw new Error("Nama prodi wajib diisi.");
      return write(async (client) => {
        const department = await client.query("SELECT active FROM departments WHERE id=$1 FOR UPDATE", [command.departmentId]);
        if (!department.rows[0]?.active) throw new Error("Jurusan tujuan tidak aktif.");
        const id = command.id ?? slug(name);
        const before = (await client.query(`SELECT id,department_id AS "departmentId",name,active FROM study_programs WHERE id=$1 FOR UPDATE`, [id])).rows[0] ?? null;
        const result = await client.query<StudyProgram>(
          `INSERT INTO study_programs(id,department_id,name,active) VALUES($1,$2,$3,$4)
           ON CONFLICT(id) DO UPDATE SET department_id=EXCLUDED.department_id,name=EXCLUDED.name,
             active=EXCLUDED.active,updated_at=now()
           RETURNING id,department_id AS "departmentId",name,active`,
          [id, command.departmentId, name, command.active],
        );
        await addAudit(client, access, before ? "update" : "create", "study_program", id, before, result.rows[0]);
        return result.rows[0];
      });
    },
    async saveMember(command: MemberCommand, access: AccessContext) {
      requireAdmin(access);
      const value = normalizeMember(command);
      return write(async (client) => {
        if (value.departmentId) {
          const target = await client.query("SELECT active FROM departments WHERE id=$1 FOR UPDATE", [value.departmentId]);
          if (!target.rows[0]?.active) throw new Error("Jurusan cakupan tidak aktif.");
        }
        if (value.studyProgramId) {
          const target = await client.query("SELECT active FROM study_programs WHERE id=$1 FOR UPDATE", [value.studyProgramId]);
          if (!target.rows[0]?.active) throw new Error("Prodi cakupan tidak aktif.");
        }
        const before = (await client.query(`SELECT email,role,scope_type AS "scopeType",department_id AS "departmentId",
          study_program_id AS "studyProgramId",active FROM team_members WHERE email=$1 FOR UPDATE`, [value.email])).rows[0] ?? null;
        if (before?.role === "admin" && before.active && (!value.active || value.role !== "admin")) {
          const count = await client.query("SELECT count(*)::int AS count FROM team_members WHERE role='admin' AND active=true");
          if (count.rows[0].count <= 1) throw new Error("Aplikasi harus memiliki minimal satu Admin aktif.");
        }
        const result = await client.query<MemberRecord>(
          `INSERT INTO team_members(email,role,scope_type,department_id,study_program_id,active)
           VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(email) DO UPDATE SET role=EXCLUDED.role,
           scope_type=EXCLUDED.scope_type,department_id=EXCLUDED.department_id,
           study_program_id=EXCLUDED.study_program_id,active=EXCLUDED.active,updated_at=now()
           RETURNING email,role,scope_type AS "scopeType",department_id AS "departmentId",
             study_program_id AS "studyProgramId",active`,
          [value.email,value.role,value.scopeType,value.departmentId,value.studyProgramId,value.active],
        );
        await addAudit(client, access, before ? "update" : "create", "member", value.email, before, result.rows[0]);
        return result.rows[0];
      });
    },
  };
}

export function connectPostgres(connectionString: string) {
  const pool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 20_000,
    allowExitOnIdle: true,
  });
  pool.on("error", () =>
    console.error("Koneksi database terputus; koneksi baru akan dibuat pada permintaan berikutnya."),
  );
  return createPostgresStore(pool);
}
