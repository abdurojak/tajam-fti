# Organizational Access Design

## Purpose

TAJAM FTI needs role-based access that follows the faculty organization. Administrators manage and view all data. Other members receive either read-only or editing access to one department or one study program. All authorization is enforced on the server so hidden UI controls cannot be bypassed with direct API calls or modified imports.

## Organization hierarchy

The hierarchy is Faculty → Department → Study Program → Content. The initial structure is:

- Jurusan Teknik Informatika
  - Teknik Informatika
  - Sistem Informasi
- Jurusan Teknik Elektro
  - Teknik Elektro
  - Magister Teknik Elektro
- Jurusan Teknik Industri
  - Teknik Industri
  - Magister Teknik Industri
  - Doktor Teknik Industri
- Jurusan Teknik Mesin
  - Teknik Mesin
  - Magister Teknik Mesin
- Jurusan Program Profesi Insinyur
  - Program Profesi Insinyur

Seeded database values and product labels use these exact Indonesian names.

Administrators can add and rename departments and study programs. A unit that has been referenced by content or members cannot be permanently deleted; it can be deactivated. Deactivated units remain visible in historical records and within the access scope of existing members, but cannot be selected for new content or new assignments.

## Roles and scopes

The roles are:

- `admin`: full read and write access to all content, organization units, and members.
- `editor`: read, create, update, delete, import, and export within the assigned scope.
- `viewer`: read and export within the assigned scope.

Every non-admin member has exactly one scope:

- Department scope grants access to every study program belonging to one department.
- Study-program scope grants access to exactly one study program.

Administrators have global scope and cannot carry a department or study-program assignment. The system must always retain at least one active administrator. An administrator cannot demote or deactivate themself if that would leave no other active administrator.

The initial members are:

| Email | Role | Scope |
|---|---|---|
| `labtif.fti@trisakti.ac.id` | Admin | Global |
| `iwan.purwanto@trisakti.ac.id` | Admin | Global |
| `abdurojak@trisakti.ac.id` | Editor | Department of Informatics Engineering |
| `ricardo.dharma@trisakti.ac.id` | Editor | Department of Informatics Engineering |
| `aszani@trisakti.ac.id` | Editor | Information Systems study program |
| `rifdah.amelia@trisakti.ac.id` | Editor | Information Systems study program |
| `tri.swasono@trisakti.ac.id` | Editor | Department of Electrical Engineering |
| `thalia.pk@trisakti.ac.id` | Editor | Department of Industrial Engineering |
| `agus.dwicahyo@trisakti.ac.id` | Editor | Department of Mechanical Engineering |

The database stores normalized lowercase email addresses. Google sign-in still requires a Google-verified email address. Future membership changes take effect from the database without a Netlify redeploy.

## Data model

Neon/PostgreSQL gains four tables:

- `departments`: stable ID, unique case-insensitive name, active flag, timestamps.
- `study_programs`: stable ID, department foreign key, name unique within its department, active flag, timestamps.
- `team_members`: normalized email primary key, role, scope type, optional department or study-program foreign key, active flag, timestamps. Database checks enforce valid role/scope combinations.
- `access_audit_log`: actor email, action, entity type and ID, before/after JSON, and timestamp.

The `content` table gains a non-null `study_program_id` foreign key after legacy data is mapped. The remaining content fields stay in the JSON payload. The application hydrates the displayed `prodi` value from the referenced study program rather than treating a mutable name as identity. Renaming a study program therefore updates every display without rewriting historical content.

Migration maps existing `payload.prodi` names to seeded study programs using normalized exact names. It aborts with a clear diagnostic if any legacy name is unknown or maps ambiguously. The migration is idempotent and preserves IDs, timestamps, fingerprints, and content payloads. SQLite local mode receives equivalent schema behavior and treats the local operator as an administrator.

## Authentication and authorization

Google OAuth requests only `openid email profile`. On sign-in, the server accepts a verified Google email only when an active `team_members` row exists. `ALLOWED_EMAILS` is retired as the authorization source after the migration and remains documented only as a temporary rollback aid.

Every protected page and API request resolves an access context from the current email and the latest member, department, and study-program records. The context contains the role and allowed study-program IDs. Database authorization is re-evaluated on every request so deactivation, role changes, and scope changes apply immediately even if a signed session cookie has not expired.

Server-side rules are:

- List and report queries filter by allowed study-program IDs before returning rows.
- Create validates that the selected study program is active and within scope.
- Update and delete first resolve the existing row and reject operations outside scope. Moving content to another study program also validates the destination.
- Import validates every row and rejects the entire batch if any row is outside scope or references an inactive or unknown study program.
- Viewer write requests return HTTP 403.
- Membership and organization endpoints require Admin.
- Export operates only on server-authorized rows already returned to the user.

Local mode keeps its current loopback-only safety boundary and receives an implicit Admin context.

## User interface

The main navigation shows the signed-in member's role and scope. Admin receives two additional views:

- **Kelola Anggota**: add a verified organization email, choose role and scope, change assignments, activate or deactivate members, and review the relevant audit history.
- **Kelola Organisasi**: add, rename, and activate or deactivate departments and study programs.

Editor and Viewer interfaces are constrained by their scope. A study-program Editor sees a fixed study-program value in content forms. A department Editor can select only active study programs in that department. Viewers do not see create, edit, delete, or import controls. Admin can select any active study program. Filters, dashboard totals, charts, calendars, reports, Excel, PDF, and ICS exports are calculated only from authorized data.

Interface restrictions improve clarity but never substitute for server authorization.

## Errors and invariants

- Unknown, inactive, or unregistered emails see an access-not-granted page without revealing membership details.
- Assigning a non-admin without exactly one valid scope fails validation.
- Assigning a member to an inactive unit fails validation.
- Deactivating a unit prevents new content and new member assignments while preserving historical reads.
- A rename uses a transaction and unique constraints to prevent duplicate organization names.
- Import is atomic: either all authorized, valid rows are written or none are.
- Attempts to remove the last active Admin fail with a clear message.
- Admin organization and membership mutations write audit entries in the same database transaction as the change.

## Testing

Unit tests cover normalized emails, role/scope validation, allowed study-program resolution, inactive units, and last-Admin protection. Store and API tests cover the complete matrix of Admin, department Editor, study-program Editor, department Viewer, study-program Viewer, inactive member, and unknown member across list, create, update, delete, import, and export-related reads.

Migration tests use legacy records for every current study-program name and verify preserved IDs and timestamps. They also prove that unknown and ambiguous names abort without partial changes. Import tests verify that a mixed authorized/unauthorized workbook writes no rows. UI tests verify that available controls and study-program choices match the access context. Existing workbook compatibility, PDF, ICS, authentication, CSRF, type checking, production build, and cloud integration checks remain required.

## Deployment

Deployment proceeds in two compatible stages:

1. Apply the idempotent schema migration and seed the approved organization and initial members while the current application remains operational.
2. Deploy the role-aware application from `main`, verify both Admin and scoped access, then remove operational dependence on `ALLOWED_EMAILS`.

The release checklist verifies an Admin account, a department Editor, a study-program Editor, and an unauthorized account. It also verifies that an Editor cannot cross scope through a direct API request or Excel import. Rollback keeps the additive tables and columns intact so reverting application code does not destroy organization or audit data.

## Capacity

The application does not impose a fixed member count. The expected internal workload of 10–100 active members is appropriate for the current architecture. Capacity is monitored through Netlify request, bandwidth, and compute credits plus Neon storage and compute usage; upgrades are based on measured activity rather than registered account count.
