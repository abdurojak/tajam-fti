# Google Calendar Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically keep one all-day Google Calendar event for each non-cancelled TAJAM content event date in a shared team calendar.

**Architecture:** PostgreSQL records an idempotent calendar job in the same transaction as each content mutation. Route handlers attempt the job after commit with server-only Google OAuth credentials, while a retry endpoint and browser-driven import batches recover failures. A focused Calendar client owns token refresh and Google HTTP calls; pure mapping code owns event construction and safe error classification.

**Tech Stack:** Next.js 16 App Router, NextAuth 4 JWT sessions, PostgreSQL/Neon, Google Calendar API v3 over `fetch`, React 19, Vitest, Netlify.

---

## File Structure

- Create `db/003-google-calendar-sync.sql`: idempotent calendar job/mapping schema and migration registration.
- Create `src/lib/calendar-sync.ts`: shared sync types, deterministic event ID, all-day event mapping, and safe error categories.
- Create `src/lib/google-calendar.ts`: token refresh plus the small Google Calendar HTTP adapter.
- Create `src/lib/calendar-service.ts`: coordinates authorized jobs, database state, and Google calls.
- Create `src/app/api/calendar/sync/route.ts`: retry and browser-batch endpoint.
- Create `src/types/next-auth.d.ts`: server JWT token fields used by the OAuth flow.
- Create `tests/calendar-sync.test.ts`: pure event and error behavior.
- Create `tests/google-calendar.test.ts`: HTTP adapter and refresh behavior with a fake `fetch`.
- Create `tests/calendar-service.test.ts`: idempotent create/update/delete orchestration.
- Modify `src/lib/auth.ts`: request Calendar scope, retain server-only OAuth tokens, and return credentials to server routes.
- Modify `src/lib/postgres-store.ts`: enqueue jobs transactionally and expose scoped job/status methods.
- Modify `src/lib/store.ts`: return disabled calendar status in local mode without calling Google.
- Modify `src/lib/domain.ts`: expose calendar status on content views without changing imported content fields.
- Modify content/import API routes: attempt sync after committed mutations and return sync results.
- Modify `src/components/planner.tsx`, `content-table.tsx`, `import-dialog.tsx`, `guide.tsx`, and `globals.css`: show status, retry failures, and run import batches.
- Modify `.env.example`, `README.md`, `docs/deployment.md`, `scripts/check-cloud.mjs`, and PostgreSQL tests: configuration, rollout, and integration coverage.

### Task 1: Define Calendar Sync Types and Event Mapping

**Files:**
- Create: `src/lib/calendar-sync.ts`
- Create: `tests/calendar-sync.test.ts`
- Modify: `src/lib/domain.ts`

- [ ] **Step 1: Write failing tests for deterministic IDs and all-day event mapping**

```ts
import { describe, expect, it } from "vitest";
import { buildCalendarEvent, googleEventId } from "../src/lib/calendar-sync";
import { valid } from "./fixtures";

describe("Google Calendar event mapping", () => {
  it("uses a stable Google-compatible event id", () => {
    expect(googleEventId("550e8400-e29b-41d4-a716-446655440000"))
      .toBe("tajam550e8400e29b41d4a716446655440000");
  });

  it("creates only an all-day event for the activity date", () => {
    expect(buildCalendarEvent({ ...valid, id: "550e8400-e29b-41d4-a716-446655440000" }))
      .toMatchObject({
        id: "tajam550e8400e29b41d4a716446655440000",
        summary: valid.idea,
        start: { date: valid.dateEvent },
        end: { date: "2026-09-19" },
        extendedProperties: { private: { tajamContentId: "550e8400-e29b-41d4-a716-446655440000" } },
      });
  });
});
```

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

Run: `npx vitest run tests/calendar-sync.test.ts`

Expected: FAIL because `src/lib/calendar-sync.ts` does not exist.

- [ ] **Step 3: Implement sync types and pure event construction**

Define:

```ts
export type CalendarSyncStatus = "pending" | "synced" | "failed" | "disabled";
export type CalendarSyncSummary = { status: CalendarSyncStatus; error: string | null };
export type CalendarContent = Content & { calendarSync: CalendarSyncSummary };
export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  description: string;
  start: { date: string };
  end: { date: string };
  extendedProperties: { private: { tajamContentId: string } };
};
```

Implement `googleEventId(contentId)` by lowercasing and removing every non-base32hex character, prefixing `tajam`, and rejecting an empty result. Implement `nextDate(date)` with UTC arithmetic. Implement `buildCalendarEvent(content)` using `dateEvent` only and a description containing prodi, activity, channel, PIC, format, status, notes, and a TAJAM ownership line. Do not add `dateUpload` to the event.

- [ ] **Step 4: Add calendar status to the content view without changing `ContentInput`**

Keep the twelve spreadsheet fields unchanged. Export `CalendarContent` from `calendar-sync.ts`; do not add sync fields to `FIELDS`, workbook parsing, fingerprints, or validation.

- [ ] **Step 5: Run the focused tests**

Run: `npx vitest run tests/calendar-sync.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the pure domain layer**

```bash
git add src/lib/calendar-sync.ts src/lib/domain.ts tests/calendar-sync.test.ts
git commit -m "feat: define Google Calendar event mapping"
```

### Task 2: Add the Durable PostgreSQL Calendar Job

**Files:**
- Create: `db/003-google-calendar-sync.sql`
- Modify: `tests/migration.test.ts`
- Modify: `tests/postgres.test.ts`
- Modify: `src/lib/postgres-store.ts`
- Modify: `src/lib/store.ts`

- [ ] **Step 1: Write migration and PostgreSQL tests first**

Add assertions that migration 003 creates `content_calendar_events`, constrains `desired_action` to `upsert/delete`, constrains `sync_status` to `pending/synced/failed`, has no foreign key from `content_id`, indexes status, and records `003-google-calendar-sync.sql` in `schema_migrations`.

In `tests/postgres.test.ts`, add failing cases proving:

```ts
const created = await store.create(valid, admin);
expect(await store.getCalendarJob(created.id, admin)).toMatchObject({
  contentId: created.id,
  desiredAction: "upsert",
  syncStatus: "pending",
});

await store.update(created.id, { ...valid, status: "Batal" }, admin);
expect(await store.getCalendarJob(created.id, admin)).toMatchObject({ desiredAction: "delete" });

await store.remove(created.id, admin);
expect(await store.getCalendarJob(created.id, admin)).toMatchObject({
  desiredAction: "delete",
  content: null,
});
```

Also assert that a scoped Editor cannot read or retry a job outside `study_program_id`.

- [ ] **Step 2: Run migration and PostgreSQL tests and verify failure**

Run: `npx vitest run tests/migration.test.ts tests/postgres.test.ts`

Expected: migration assertions fail; PostgreSQL tests skip without `TEST_DATABASE_URL` or fail on missing table/methods when the variable is present.

- [ ] **Step 3: Create migration 003**

Use this schema:

```sql
CREATE TABLE IF NOT EXISTS content_calendar_events (
  content_id TEXT PRIMARY KEY,
  study_program_id TEXT NOT NULL REFERENCES study_programs(id),
  calendar_id TEXT,
  google_event_id TEXT NOT NULL,
  desired_action TEXT NOT NULL CHECK (desired_action IN ('upsert','delete')),
  sync_status TEXT NOT NULL CHECK (sync_status IN ('pending','synced','failed')),
  last_error TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_calendar_sync_idx
  ON content_calendar_events(sync_status,updated_at,content_id);
```

Do not add a foreign key from `content_id`; the row is the deletion tombstone. Insert the migration filename into `schema_migrations` at the end.

- [ ] **Step 4: Add store contracts and transactional enqueueing**

Add `CalendarJob` and methods:

```ts
getCalendarJob(id: string, access: AccessContext): Promise<CalendarJob | null>;
listCalendarJobs(ids: string[], limit: number, access: AccessContext): Promise<CalendarJob[]>;
markCalendarSynced(id: string, action: "upsert" | "delete"): Promise<void>;
markCalendarFailed(id: string, message: string, retryable: boolean): Promise<void>;
assignCalendarTarget(id: string, calendarId: string): Promise<CalendarJob>;
```

Within the same `write()` transaction as create/update/import, upsert a row with deterministic event ID, configured calendar ID, program ID, desired action derived from status, `pending`, and cleared error. Before deleting content, upsert a `delete` tombstone using the existing program ID. `markCalendarSynced(delete)` removes the tombstone; `markCalendarSynced(upsert)` sets `synced` and timestamps it.

Join the mapping in PostgreSQL list/create/update results and return `disabled` from SQLite. Enqueue with a nullable calendar ID when configuration is absent, return `failed` with “Google Calendar belum dikonfigurasi.”, and let `assignCalendarTarget` fill the target exactly once after configuration becomes available. Never replace an existing non-null target silently.

- [ ] **Step 5: Run migration tests and disposable PostgreSQL tests**

Run: `npx vitest run tests/migration.test.ts tests/postgres.test.ts`

Expected: PASS when `TEST_DATABASE_URL` is configured; migration tests always pass.

- [ ] **Step 6: Run store regression tests**

Run: `npx vitest run tests/store.test.ts tests/admin.test.ts`

Expected: PASS; local SQLite never calls Google.

- [ ] **Step 7: Commit durable jobs**

```bash
git add db/003-google-calendar-sync.sql src/lib/postgres-store.ts src/lib/store.ts tests/migration.test.ts tests/postgres.test.ts
git commit -m "feat: persist Google Calendar sync jobs"
```

### Task 3: Capture Server-Only Google OAuth Credentials

**Files:**
- Create: `src/types/next-auth.d.ts`
- Modify: `src/lib/auth.ts`
- Modify: `src/lib/access.ts`
- Modify: `tests/access.test.ts`

- [ ] **Step 1: Write failing OAuth configuration tests**

Extract `googleAuthorizationParams()` and test exact behavior:

```ts
expect(googleAuthorizationParams()).toEqual({
  scope: "openid email profile https://www.googleapis.com/auth/calendar.events",
  access_type: "offline",
  prompt: "select_account consent",
});
```

Test that `calendarConfigurationReady()` requires `DATABASE_URL`, Google OAuth settings, and `GOOGLE_CALENDAR_ID`, while normal authentication readiness continues to work without the calendar ID.

- [ ] **Step 2: Run the access tests and verify failure**

Run: `npx vitest run tests/access.test.ts`

Expected: FAIL on missing helpers and old OAuth params.

- [ ] **Step 3: Extend the JWT callback without exposing tokens in session**

Add JWT fields `googleAccessToken`, `googleRefreshToken`, `googleAccessTokenExpiresAt`, and `googleTokenError`. On initial account callback, retain `access_token`, `refresh_token`, and `expires_at`. Preserve the previous refresh token when Google omits it. Keep the session callback limited to the member email; never copy OAuth tokens into `session`.

Add `calendarCredentials(request)` using `getToken({ req, secret })`. It must return a typed credentials object or a safe reason requiring re-login. Token refresh implementation is added in Task 4; this task wires the call boundary.

- [ ] **Step 4: Run access/auth tests and typecheck**

Run: `npx vitest run tests/access.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit OAuth wiring**

```bash
git add src/types/next-auth.d.ts src/lib/auth.ts src/lib/access.ts tests/access.test.ts
git commit -m "feat: request server-only Calendar credentials"
```

### Task 4: Implement the Google Calendar HTTP Adapter

**Files:**
- Create: `src/lib/google-calendar.ts`
- Create: `tests/google-calendar.test.ts`
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Write failing tests against an injected fake fetch**

Cover:

- refresh POST to `https://oauth2.googleapis.com/token` with client ID, client secret, refresh token, and `grant_type=refresh_token`;
- update via `PUT /calendar/v3/calendars/{calendarId}/events/{eventId}`;
- update 404 followed by insert via `POST /events`;
- insert 409 followed by update, proving concurrent retries converge;
- delete 404 treated as success;
- 401/403 classified as permission failures;
- 429/5xx/network timeout classified as retryable.

Construct the adapter with dependency injection:

```ts
const client = createGoogleCalendarClient({ fetch: fakeFetch, timeoutMs: 5_000 });
```

- [ ] **Step 2: Run the adapter tests and verify failure**

Run: `npx vitest run tests/google-calendar.test.ts`

Expected: FAIL because the adapter module does not exist.

- [ ] **Step 3: Implement refresh and event methods**

Export `refreshGoogleAccessToken`, `upsertEvent`, and `deleteEvent`. Encode calendar and event IDs with `encodeURIComponent`, send bearer authorization, JSON content type, and an `AbortSignal.timeout`. Parse only bounded Google error fields and map them to `CalendarSyncError` with `safeMessage` and `retryable`; never include tokens or complete response bodies.

- [ ] **Step 4: Integrate refresh fallback into `calendarCredentials(request)`**

Use a valid access token when it has more than 60 seconds remaining. Otherwise refresh from the encrypted JWT refresh token and return the new access token for the current request. If refresh fails, return “Izin Google Calendar berakhir. Silakan keluar lalu masuk kembali.”

- [ ] **Step 5: Run adapter, access, and type tests**

Run: `npx vitest run tests/google-calendar.test.ts tests/access.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the adapter**

```bash
git add src/lib/google-calendar.ts src/lib/auth.ts tests/google-calendar.test.ts
git commit -m "feat: add Google Calendar API client"
```

### Task 5: Coordinate Idempotent Synchronization

**Files:**
- Create: `src/lib/calendar-service.ts`
- Create: `tests/calendar-service.test.ts`
- Create: `src/app/api/calendar/sync/route.ts`
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Write failing service tests with narrow fakes**

Use a fake job store and fake Calendar client to prove:

```ts
await syncCalendarJob(job, credentials, dependencies);
expect(calendar.upsertEvent).toHaveBeenCalledWith(job.calendarId, buildCalendarEvent(job.content), credentials);
expect(store.markCalendarSynced).toHaveBeenCalledWith(job.contentId, "upsert");
```

Also test delete tombstones, cancelled content, missing content converted to delete, retryable versus permanent failure state, and a second run using the same deterministic event ID.

- [ ] **Step 2: Run the service test and verify failure**

Run: `npx vitest run tests/calendar-service.test.ts`

Expected: FAIL because `calendar-service.ts` is missing.

- [ ] **Step 3: Implement the orchestration service**

Implement `syncCalendarJob` and `syncCalendarJobs({ ids, limit, access, credentials })`. Cap `limit` at 20, deduplicate IDs, verify store scope, and return:

```ts
type CalendarBatchResult = {
  processed: number;
  synced: string[];
  failed: Array<{ id: string; error: string; retryable: boolean }>;
};
```

An absent calendar configuration returns a safe failed result. Never let one failed job stop the rest of a batch.

- [ ] **Step 4: Add the retry route**

`POST /api/calendar/sync` must call `requireAccess("write")`, validate origin, obtain server credentials, accept `{ ids?: string[], limit?: number }`, and call the service. Viewer gets 403; unknown/out-of-scope IDs are omitted without leaking their existence. Set `Cache-Control: private, no-store`.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npx vitest run tests/calendar-service.test.ts tests/api.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit orchestration and endpoint**

```bash
git add src/lib/calendar-service.ts src/app/api/calendar/sync/route.ts src/lib/api.ts tests/calendar-service.test.ts tests/api.test.ts
git commit -m "feat: synchronize queued Calendar events"
```

### Task 6: Trigger Sync from Content Mutations

**Files:**
- Modify: `src/app/api/content/route.ts`
- Modify: `src/app/api/content/[id]/route.ts`
- Modify: `src/app/api/import/route.ts`
- Modify: `tests/calendar-service.test.ts`
- Modify: `scripts/check-cloud.mjs`

- [ ] **Step 1: Write failing route-level tests for committed-data semantics**

Test helpers extracted from the routes so that create/update/delete:

1. commit the database mutation;
2. attempt exactly that content ID;
3. return the saved result even when Calendar fails; and
4. attach the final safe sync status.

For delete, return `{ ok: true, calendarSync }`. For import, return `{ added, skipped, ids }` without synchronously sending thousands of Google calls.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npx vitest run tests/calendar-service.test.ts`

Expected: FAIL because routes do not invoke synchronization and import does not return IDs.

- [ ] **Step 3: Add post-commit sync attempts**

Create/update/delete routes obtain Calendar credentials from the same request after authorization, then call one-job synchronization. Calendar errors are represented in response data, not thrown as a false database failure. Keep 404 and authorization behavior unchanged.

The import route returns inserted IDs. Update `scripts/check-cloud.mjs` to accept the additive response property and verify that pending jobs exist without calling real Google.

- [ ] **Step 4: Run API and cloud integration checks**

Run: `npx vitest run tests/api.test.ts tests/postgres.test.ts`

Then, with a disposable PostgreSQL database: `npm run build && npm run test:cloud`.

Expected: PASS; no Google production credentials are required by the cloud check.

- [ ] **Step 5: Commit mutation integration**

```bash
git add src/app/api/content src/app/api/import/route.ts tests scripts/check-cloud.mjs
git commit -m "feat: trigger Calendar sync after content changes"
```

### Task 7: Add Status, Retry, and Import Batching to the UI

**Files:**
- Modify: `src/components/planner.tsx`
- Modify: `src/components/content-table.tsx`
- Modify: `src/components/import-dialog.tsx`
- Modify: `src/app/globals.css`
- Create: `tests/calendar-ui.test.ts`

- [ ] **Step 1: Write failing tests for UI state helpers**

Extract and test pure helpers `calendarStatusLabel`, `mergeCalendarResults`, and `calendarBatchIds`. Assert synced/pending/failed labels, safe error preservation, deduplicated batches of at most 20, and Viewer retry disabled.

- [ ] **Step 2: Run UI helper tests and verify failure**

Run: `npx vitest run tests/calendar-ui.test.ts`

Expected: FAIL because the helpers do not exist.

- [ ] **Step 3: Render status and retry controls**

Extend planner rows to `CalendarContent[]`. In `ContentTable`, render a compact calendar badge for online mode. For `failed` and `pending`, show **Sinkronkan ulang** only when `canWrite`; clicking calls `/api/calendar/sync` with the row ID and merges the returned status. Display the safe error in accessible helper text/title, not a raw Google response.

- [ ] **Step 4: Run browser-driven import batches**

After `/api/import` returns IDs, split them into batches of 20 and call `/api/calendar/sync` sequentially. Update progress text (`Menyinkronkan kalender 20/75`) and refresh content after completion. A failed batch leaves saved data intact and reports how many calendar items still need retry.

- [ ] **Step 5: Style and verify responsive behavior**

Add badge colors for synced/pending/failed and a compact retry button that fits the existing table/card layouts. Confirm keyboard focus, accessible labels, mobile wrapping, and no write control for Viewer.

- [ ] **Step 6: Run UI helpers, full tests, and build**

Run: `npx vitest run tests/calendar-ui.test.ts && npm test && npm run typecheck && npm run build`

Expected: all active tests and build pass.

- [ ] **Step 7: Commit the UI**

```bash
git add src/components/planner.tsx src/components/content-table.tsx src/components/import-dialog.tsx src/app/globals.css tests/calendar-ui.test.ts
git commit -m "feat: show and retry Calendar synchronization"
```

### Task 8: Document Consent and Production Configuration

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/deployment.md`
- Modify: `src/components/guide.tsx`
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Add configuration and user guidance**

Add `GOOGLE_CALENDAR_ID=` to `.env.example`. Document enabling Google Calendar API, adding the internal `calendar.events` scope, creating the shared calendar, sharing it with **Make changes to events**, copying its Calendar ID, updating Netlify, and requiring every member to log out/in once.

Replace the old “Google Calendar belum tersinkron otomatis” copy. State clearly that only `Tanggal Acara` syncs, events are all-day, Batal/delete removes them, and ICS remains a manual export option.

- [ ] **Step 2: Add configuration-aware login copy**

When cloud auth is ready but `GOOGLE_CALENDAR_ID` is absent, keep login available and show an Admin-facing integration warning rather than blocking the entire application.

- [ ] **Step 3: Verify no stale claims remain**

Run:

```bash
rg -n "belum tersinkron otomatis|integrasi berikutnya|GOOGLE_CALENDAR_ID|calendar.events" README.md docs src .env.example
```

Expected: old automatic-sync limitation text is gone; new configuration appears in all required places.

- [ ] **Step 4: Commit documentation**

```bash
git add .env.example README.md docs/deployment.md src/components/guide.tsx src/app/login/page.tsx
git commit -m "docs: explain shared Calendar setup"
```

### Task 9: Final Verification and Rollout

**Files:**
- Modify if required by findings: files from Tasks 1–8 only

- [ ] **Step 1: Run the full local verification suite**

Run:

```bash
npm test
npm run typecheck
npm run build
npm audit
git diff --check
```

Expected: tests/typecheck/build/diff check pass and audit reports zero known vulnerabilities. If the audit service is unavailable, record that external failure rather than claiming an audit result.

- [ ] **Step 2: Run disposable PostgreSQL and cloud checks**

Set `TEST_DATABASE_URL` to a disposable database only, then run:

```bash
npm test
npm run test:cloud
```

Expected: PostgreSQL migration/job tests and cloud CRUD/import checks pass.

- [ ] **Step 3: Review the branch against the design**

Confirm: shared calendar only; `dateEvent` only; all-day event; Draf/Terbit upsert; Batal/delete remove; tokens remain server-only; database writes survive Google failure; import batches; scoped retry; safe errors; local SQLite disabled.

- [ ] **Step 4: Commit any verification fixes**

```bash
git add db src tests scripts .env.example README.md docs/deployment.md
git commit -m "fix: complete Calendar sync verification"
```

Skip this commit when verification required no changes.

- [ ] **Step 5: Prepare production in safe order**

Before merging code:

1. enable Calendar API and internal OAuth scope;
2. create/share the team calendar;
3. add `GOOGLE_CALENDAR_ID` to Netlify;
4. run `npm run db:migrate` against Neon;
5. merge and wait for Netlify production deployment.

- [ ] **Step 6: Verify one production lifecycle**

Log out and back in with Calendar consent. Create a Draf item with a unique title, verify one all-day event, change its date/title and verify the same event changes, set Batal and verify removal, reactivate and verify one new event, then delete and verify removal. Remove the test content afterward and record the production deploy URL and commit.
