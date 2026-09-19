# Organizational Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add database-managed departments, study programs, members, roles, and server-enforced scoped access to TAJAM FTI.

**Architecture:** PostgreSQL and SQLite store normalized organization and membership records. Authentication resolves an active member into an access context on every request, and stores apply that context to all content operations. Admin-only APIs maintain organization and membership data with transactional audit logs; UI capability checks improve clarity but never replace server authorization.

**Tech Stack:** Next.js 16 App Router route handlers, NextAuth 4, TypeScript, React 19, PostgreSQL/Neon, better-sqlite3, Vitest, Netlify.

---

## File map

- `src/lib/organization.ts`: types, validation, access context, capabilities.
- `db/002-organizational-access.sql`: PostgreSQL schema, seeds, backfill.
- `src/lib/postgres-store.ts`, `src/lib/store.ts`, `src/lib/database.ts`: scoped storage and Admin transactions.
- `src/lib/auth.ts`, `src/lib/access.ts`: database-backed membership.
- `src/app/api/content/**`, `src/app/api/import/route.ts`: scoped content APIs.
- `src/app/api/access/route.ts`, `src/app/api/admin/**`: access metadata and Admin APIs.
- `src/components/member-manager.tsx`, `organization-manager.tsx`, and existing planner components: role-aware UI.
- `tests/**`, `scripts/check-cloud.mjs`, `README.md`, `docs/deployment.md`: verification and operations.

## Task 1: Define organization and authorization rules

**Files:** Create `src/lib/organization.ts`, `tests/organization.test.ts`.

- [ ] **Write a failing test** for Admin normalization, invalid non-Admin scope, department/program resolution, and Viewer capabilities:

```ts
expect(normalizeMember({ email: " ADMIN@Example.com ", role: "admin" })).toMatchObject({
  email: "admin@example.com", role: "admin", scopeType: "global",
  departmentId: null, studyProgramId: null,
});
expect(() => normalizeMember({ email: "x@example.com", role: "editor" }))
  .toThrow("Pilih satu cakupan");
expect(programIdsFor(
  { role: "editor", scopeType: "department", scopeId: "jtif" },
  [{ id: "ti", departmentId: "jtif", name: "Teknik Informatika", active: true }],
)).toEqual(["ti"]);
expect(capabilitiesFor("viewer").canWriteContent).toBe(false);
```

- [ ] Run `npm test -- tests/organization.test.ts`; expect failure because the module is missing.
- [ ] Implement `Role = "admin" | "editor" | "viewer"`, `ScopeType`, `Department`, `StudyProgram`, `MemberRecord`, `AccessContext`, `normalizeMember`, `programIdsFor`, `capabilitiesFor`, and `localAdminAccess`. Admin always normalizes to global scope. A non-Admin must have exactly one department or study-program scope.
- [ ] Re-run the focused test; expect PASS.
- [ ] Commit: `git commit -m "feat: define organizational access rules"`.

## Task 2: Add PostgreSQL schema, seeds, and safe legacy migration

**Files:** Create `db/002-organizational-access.sql`; modify `scripts/migrate-db.mjs`, `tests/postgres.test.ts`.

- [ ] **Write a failing integration test** that inserts a legacy `Teknik Mesin` row, applies migration 002, and expects `study_program_id = 'teknik-mesin'`, five departments, ten programs, and two seeded Admins. Add a second test proving an unknown legacy program aborts without recording migration 002.
- [ ] Run the test with a disposable `TEST_DATABASE_URL`; expect missing migration failure. Never use production.
- [ ] Create `departments`, `study_programs`, `team_members`, `access_audit_log`, and `schema_migrations`. Add `content.study_program_id`, its foreign key/index, and these checks:

```sql
CHECK (role IN ('admin','editor','viewer')),
CHECK (scope_type IN ('global','department','study_program')),
CHECK (
  (role='admin' AND scope_type='global' AND department_id IS NULL AND study_program_id IS NULL)
  OR (role<>'admin' AND scope_type='department' AND department_id IS NOT NULL AND study_program_id IS NULL)
  OR (role<>'admin' AND scope_type='study_program' AND department_id IS NULL AND study_program_id IS NOT NULL)
)
```

- [ ] Seed the exact approved hierarchy with stable kebab-case IDs and the nine approved members. Use `ON CONFLICT` idempotently.
- [ ] Backfill legacy rows using normalized exact `payload->>'prodi'` names. Raise before `NOT NULL` when any name is unknown/ambiguous. Preserve IDs, timestamps, fingerprint, and payload.
- [ ] Change the runner to apply sorted `db/[0-9][0-9][0-9]-*.sql` files once under the existing advisory lock, one transaction per migration.
- [ ] Re-run migration tests twice; expect PASS and idempotence.
- [ ] Commit: `git commit -m "feat: add organizational database schema"`.

## Task 3: Enforce scopes in PostgreSQL storage

**Files:** Modify `src/lib/postgres-store.ts`, `src/lib/database.ts`, `tests/postgres.test.ts`.

- [ ] **Write failing tests** for Admin, department Editor, program Editor, and Viewer. Verify filtered reads, forbidden cross-scope create/update/delete, Viewer mutation denial, and atomic rejection of a mixed-scope import.

```ts
await expect(store.create({ ...valid, prodi: "Teknik Mesin" }, siEditor))
  .rejects.toThrow("di luar cakupan");
expect((await store.list(jtifEditor)).every((row) =>
  ["Teknik Informatika", "Sistem Informasi"].includes(row.prodi),
)).toBe(true);
```

- [ ] Run the focused test; expect method-signature/authorization failures.
- [ ] Define a shared `DatabaseStore` contract. Content methods require `AccessContext`; add `resolveAccess(email)` and `organization()`.
- [ ] Filter SQL with `study_program_id = ANY($n::text[])` for non-Admins. Resolve `input.prodi` to one active program before writes. Constrain target rows during update/delete and validate update destination.
- [ ] Hydrate current program names via a join so renames automatically appear without rewriting payload history.
- [ ] Validate all imported programs before inserting any row in the existing locked transaction.
- [ ] Re-run PostgreSQL tests; expect PASS.
- [ ] Commit: `git commit -m "feat: enforce content scope in postgres"`.

## Task 4: Add SQLite parity and local Admin behavior

**Files:** Modify `src/lib/store.ts`, `tests/store.test.ts`.

- [ ] **Write failing tests** for legacy backfill, renamed-program hydration, department filtering, Viewer rejection, and atomic mixed-scope import.
- [ ] Run `npm test -- tests/store.test.ts`; expect failures due to missing organization schema/signatures.
- [ ] Create equivalent SQLite organization/member/audit tables and seeds. Guard legacy `ALTER TABLE` with `PRAGMA table_info`; backfill in one transaction and reject unknown names.
- [ ] Implement the shared scoped store contract. Enforce referential validity transactionally because SQLite cannot add the PostgreSQL foreign-key constraint to an existing table in place.
- [ ] Treat loopback local mode as `localAdminAccess()` without creating a fake member.
- [ ] Run SQLite/domain/organization tests; expect PASS.
- [ ] Commit: `git commit -m "feat: add local organizational access parity"`.

## Task 5: Resolve membership from the database on every request

**Files:** Modify `src/lib/access.ts`, `src/lib/auth.ts`, `src/app/page.tsx`, `tests/access.test.ts`; create `src/app/api/access/route.ts`.

- [ ] **Write failing tests** showing Google identity validation needs verified provider/email but no `ALLOWED_EMAILS`; auth readiness no longer requires the allowlist; active members resolve; inactive/unknown members fail; local mode returns implicit Admin.
- [ ] Run focused tests; expect old allowlist assertions to fail.
- [ ] In NextAuth `signIn`, validate Google identity and require `getDatabase().resolveAccess(email)`. JWT stores only normalized verified email, never a trusted role.
- [ ] Implement `currentAccess()` to reload membership and organization scope from the database on every request. Implement `requireAccess("read" | "write" | "admin")` returning either access context or a 401/403 response.
- [ ] Follow installed Next.js 16 docs: Web `Request`/`Response`, Node runtime for DB routes, awaited dynamic params, and authorization beside data access (`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and `01-app/02-guides/authentication.md`).
- [ ] Make `/api/access` return only the current email, role, scope label, capabilities, departments, and permitted programs with `private, no-store`.
- [ ] Update `page.tsx` to pass serializable access metadata to `Planner` and redirect unknown cloud members.
- [ ] Run tests/typecheck; expect PASS.
- [ ] Commit: `git commit -m "feat: authorize sessions from team membership"`.

## Task 6: Enforce scope in content and import routes

**Files:** Modify `src/app/api/content/route.ts`, `src/app/api/content/[id]/route.ts`, `src/app/api/import/route.ts`, `src/lib/api.ts`, `scripts/check-cloud.mjs`.

- [ ] **Expand the failing cloud check** with signed test identities for Admin, department Editor, program Editor, department/program Viewer, inactive member, and outsider. Assert filtered reads and all mutation statuses. Include direct cross-scope PUT and mixed-scope import; both must return 403 and write nothing.
- [ ] Run `npm run build` then `npm run test:cloud`; expect authorization failures.
- [ ] GET requires read; POST/PUT/DELETE/import require write. Pass access into every store operation. Preserve origin/content-type protection.
- [ ] Map forbidden operations to 403 without revealing whether an out-of-scope record exists. Use 404 only for an in-scope missing row.
- [ ] Run `rg -n "requireMember|getDatabase\(\).*\.(list|create|update|remove|import)" src`; expect no legacy guard or unscoped store call.
- [ ] Re-run cloud verification; expect PASS.
- [ ] Commit: `git commit -m "feat: enforce scoped content api access"`.

## Task 7: Add transactional Admin APIs and audit logs

**Files:** Create `src/app/api/admin/organization/route.ts`, `src/app/api/admin/members/route.ts`, `tests/admin.test.ts`; modify both stores and their contract.

- [ ] **Write failing tests** for add/rename/deactivate department/program, add/update/deactivate member, inactive scope rejection, duplicate names, non-Admin denial, audit before/after values, and last-active-Admin protection.
- [ ] Run `npm test -- tests/admin.test.ts`; expect missing APIs/methods.
- [ ] Add commands:

```ts
type DepartmentCommand = { id?: string; name: string; active: boolean };
type StudyProgramCommand = { id?: string; departmentId: string; name: string; active: boolean };
type MemberCommand = {
  email: string; role: Role; scopeType: ScopeType;
  departmentId?: string | null; studyProgramId?: string | null; active: boolean;
};
```

- [ ] Implement `listAdministration`, `saveDepartment`, `saveStudyProgram`, and `saveMember`. Require Admin inside the service boundary, lock relevant rows, validate the resulting state, mutate, and write the audit entry in the same transaction.
- [ ] Reject deactivation/demotion of the last active Admin. Permit self-deactivation only if another active Admin remains.
- [ ] Implement Admin-only GET/POST route handlers with `mutationAllowed`, bounded JSON parsing, and no-store responses. Use activate/deactivate actions; expose no permanent-delete endpoint.
- [ ] Run Admin, store, PostgreSQL, and cloud tests; expect PASS.
- [ ] Commit: `git commit -m "feat: add audited organization administration"`.

## Task 8: Make the UI role- and scope-aware

**Files:** Modify `planner.tsx`, `content-form.tsx`, `content-table.tsx`, `dashboard.tsx`, `calendar.tsx`, `import-dialog.tsx`, `globals.css`; create `member-manager.tsx`, `organization-manager.tsx`, `tests/capabilities.test.ts`.

- [ ] **Write a failing pure capability test**: Viewer has export but no add/edit/delete/import/sample; program Editor has one fixed program; department Editor has only its active programs; Admin gets management navigation and all active programs.
- [ ] Run the test; expect missing capability helper.
- [ ] Replace `memberEmail` with `AccessSummary`. Display email, role, and scope. Dynamically add **Kelola Anggota** and **Kelola Organisasi** only for Admin.
- [ ] Hide every mutation entry point for Viewer in dashboard, table, calendar, dialogs, and empty states. Keep export enabled.
- [ ] Give program Editors a fixed program field; department Editors a select containing active programs in their department; Admin all active programs.
- [ ] Validate imported program names in preview for usability while retaining authoritative server checks.
- [ ] Build Admin managers with existing panels/dialogs/forms: create/update/activate/deactivate units and members, choose role/scope, and show recent audit actor/time. Do not add delete controls.
- [ ] Run focused tests, `npm run typecheck`, and `npm run build`; expect no warnings/errors.
- [ ] Commit: `git commit -m "feat: add scoped and administrative workspace views"`.

## Task 9: Update workbook and operational documentation

**Files:** Modify `src/lib/workbook.ts`, `tests/workbook.test.ts`, `.env.example`, `README.md`, `docs/deployment.md`, `scripts/check-cloud.mjs`.

- [ ] **Write failing workbook tests** for a dynamic authorized program dropdown and all ten seeded names. Preserve legacy `Draft` alias and namespaced OOXML tests.
- [ ] Change `createWorkbook(rows, options)` to receive authorized active program names. Exports continue using hydrated names and only rows already authorized by the server.
- [ ] Remove `ALLOWED_EMAILS` from required configuration. Document database-managed membership, Admin workflow, role matrix, deactivation, audit, initial accounts, migration order, rollback, and Internal Google Workspace audience.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, and `npm audit`; resolve failures relevant to this change.
- [ ] With a disposable PostgreSQL database, run migration twice and `npm run test:cloud`; expect idempotence and a passing access matrix.
- [ ] Commit: `git commit -m "docs: document organizational access deployment"`.

## Task 10: Review, deploy, and verify production

- [ ] Run `git diff main...HEAD --check`, inspect the full diff, map every approved spec requirement to code/tests, and confirm no credential, connection string, OAuth secret, or `.env.local` is tracked.
- [ ] Perform a clean final `npm test`, `npm run typecheck`, and `npm run build`, plus PostgreSQL/cloud checks against a disposable database.
- [ ] Apply the additive production migration using the existing secure Neon connection without printing it. Verify count-only results: five departments, ten programs, two active Admins, seven scoped Editors.
- [ ] Push the reviewed result to `main`; confirm Netlify builds the exact commit successfully.
- [ ] Verify production using Admin, department Editor, program Editor, Viewer fixture, and unregistered account. Test direct cross-scope requests, mixed import, scoped Excel/PDF/ICS/charts/calendar/reports, rename, and deactivation.
- [ ] Run `git status --short`, confirm clean state and public GitHub visibility, and report the deployed commit and URL.
