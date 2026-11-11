# TAJAM FTI Self-Hosted Deployment Design

## Goal

Move the current TAJAM FTI production data from Neon to a PostgreSQL instance on `103.28.161.35`, then run TAJAM as an isolated application at `https://lab1.trisakti.ac.id/tajam-fti/` without disrupting LabHub, Siklusa, or the other workloads on the host.

## Current host and application facts

- The host runs AlmaLinux 9.8 with 8 CPUs, 15 GiB RAM, about 7.3 GiB currently available, and about 380 GiB free disk.
- Apache owns ports 80 and 443. The active certificate includes `lab1.trisakti.ac.id` through `*.trisakti.ac.id`.
- Docker is active. Siklusa is healthy and bound only to `127.0.0.1:18010`.
- Ports `127.0.0.1:18011`, `18012`, `5432`, and `5433` are currently free.
- No host PostgreSQL service is installed or active.
- TAJAM currently runs on Netlify, uses Neon PostgreSQL, Google OAuth, and a shared Google Calendar.
- The application currently assumes a root deployment and contains absolute client API and login paths that must become base-path aware.

## Chosen architecture

TAJAM will use a dedicated Docker Compose project rooted at `/srv/tajam`. It will not join the shared `student-net` network.

The Compose project contains two services:

1. `tajam-app`: a multi-stage Node 22 image built from the reviewed TAJAM source. It listens on port 3000 inside the private Compose network and is published only as `127.0.0.1:18011` on the host.
2. `tajam-db`: PostgreSQL 17 with its own database, role, health check, and persistent bind mount at `/srv/tajam/data/postgres`. PostgreSQL has no host port mapping.

Runtime secrets live only in `/srv/tajam/shared/.env` with root ownership and mode `0600`. The Compose file contains variable references, not secret values. The application receives its database connection through the private service name `tajam-db`.

Apache retains the existing `lab1.trisakti.ac.id` virtual host. Two narrowly scoped rules are added before unrelated proxy routes:

- redirect `/tajam-fti` to `/tajam-fti/`;
- proxy `/tajam-fti/` to `http://127.0.0.1:18011/tajam-fti/` without stripping the prefix.

The active Apache file is copied to a timestamped backup before editing. `httpd -t` must pass before a graceful reload. Existing containers, ports, networks, firewall rules, and proxy entries are not changed.

## Base-path support

Production sets `TAJAM_BASE_PATH=/tajam-fti`. Local development keeps an empty base path.

`next.config.ts` reads this value and configures Next.js `basePath`. A small path helper provides one canonical way to prefix browser API calls, login redirects, and authentication callbacks. The following root assumptions are replaced or configured:

- browser requests to `/api/content`, `/api/import`, `/api/calendar/sync`, and the admin endpoints;
- browser redirects and NextAuth callbacks to `/login`;
- server redirects from the root and login pages;
- NextAuth custom sign-in and error pages;
- cloud-check scripts so the production base path can be tested explicitly.

The test suite covers an empty local prefix and `/tajam-fti`, prevents double-prefixing, and verifies representative API/login paths. Existing external publication links remain untouched.

The production authentication settings use:

- application URL: `https://lab1.trisakti.ac.id/tajam-fti`;
- `NEXTAUTH_URL`: `https://lab1.trisakti.ac.id/tajam-fti/api/auth`, whose path is used by NextAuth v4 as the client and server authentication base path;
- Google authorized redirect URI: `https://lab1.trisakti.ac.id/tajam-fti/api/auth/callback/google`.

The configured URL is verified against a production build and the generated Google authorization redirect before cutover.

## Neon backup and PostgreSQL restore

The current Neon connection string must be obtained through an authenticated source without printing it to logs or committing it. Before any production switch:

1. Test a read-only Neon connection and record count-only inventory for `content`, `departments`, `study_programs`, `team_members`, `access_audit_log`, `content_calendar_events`, and `schema_migrations`.
2. Create a PostgreSQL custom-format dump with `pg_dump --format=custom --no-owner --no-acl` using PostgreSQL 17 client tools.
3. Store the dump with mode `0600` under a timestamped local backup directory and copy it to `/srv/tajam/backups/neon/` with a SHA-256 checksum.
4. Start only `tajam-db`, restore into a new empty database with `pg_restore --exit-on-error --clean --if-exists --no-owner --no-acl`, and run the repository migration runner once to prove schema compatibility and idempotence.
5. Compare table counts, migration versions, representative content IDs, member-role counts, and calendar job status counts between Neon and the restored database. No user content is printed during verification.

The Neon database remains intact and the current Netlify site remains available during validation. This provides the rollback source until the self-hosted deployment is accepted.

## Deployment and cutover

The release uses a commit-pinned source archive or Git checkout under `/srv/tajam/releases/<commit>`. `/srv/tajam/current` points to the active release. Build metadata records the Git commit used for the image.

Deployment order:

1. Validate local tests, type checking, and production build with `/tajam-fti` enabled.
2. Create the isolated directories, secrets file, Compose file, and PostgreSQL service.
3. Restore and verify the Neon backup.
4. Build and start `tajam-app` without modifying Apache.
5. Probe the app directly at `127.0.0.1:18011/tajam-fti/login`, its static assets, and unauthenticated API guards.
6. Back up and update the Apache virtual host, validate it, then perform a graceful reload.
7. Verify the public login page, static assets, HTTPS, OAuth redirect target, authenticated access, database reads/writes, Excel import/export, and Google Calendar synchronization.
8. Keep Netlify and Neon unchanged until acceptance. Decommissioning either service is a separate explicit operation.

Because Neon can still receive writes while validation is happening, the final database cutover uses a short controlled window: create a fresh final dump, recreate the target database, restore, verify counts, and start the public self-hosted route. If continued writes on Netlify cannot be prevented, the old site must be treated as read-only or unavailable for those few minutes to avoid divergence.

## Health checks and operational boundaries

- PostgreSQL health uses `pg_isready` inside the Compose network.
- Application health uses an HTTP request to the base-path login route. The container starts only after PostgreSQL is healthy.
- Both services use `restart: unless-stopped`.
- Docker logs are size-limited to avoid unbounded disk growth.
- The database bind mount and backup directories are not served by Apache.
- PostgreSQL is never exposed through the firewall or a host listener.
- Initial resource limits prevent TAJAM from consuming resources needed by existing services; they can be adjusted after observing real usage.

## Failure handling and rollback

Before Apache reload, failures affect only the new TAJAM stack. Stop the Compose project, correct the issue, and retry.

After Apache cutover, rollback consists of restoring the timestamped Apache configuration and gracefully reloading Apache. The self-hosted containers may remain stopped for diagnosis. Netlify and Neon remain unchanged, so the prior application URL and database stay available.

Database restore failures discard only the new TAJAM database directory after the failed container has been stopped and the exact target path has been verified. LabHub, Siklusa, shared MySQL containers, Docker networks, and their files are outside the TAJAM paths and are not modified.

## Verification and acceptance

Deployment is accepted only when all of the following have fresh evidence:

- repository tests, type checking, and production build pass;
- the restored schema and count-only inventory match Neon;
- `docker compose ps` reports both TAJAM services healthy/running;
- direct loopback and public HTTPS probes return expected status codes;
- static assets load under `/tajam-fti/_next/`;
- anonymous API calls are rejected and an allowed Google account can log in;
- admin and scoped-editor access remain correct;
- a reversible test content item can be created, edited, exported, synchronized to Google Calendar, and removed or cancelled according to existing behavior;
- LabHub and Siklusa public probes and container health remain unchanged before and after Apache reload.
