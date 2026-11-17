# TAJAM FTI Self-Hosted Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run TAJAM FTI with its existing Neon data at `https://lab1.trisakti.ac.id/tajam-fti/` in an isolated Docker Compose stack on the FTI production host.

**Architecture:** Add build-time Next.js base-path support and route every internal browser/auth URL through one helper. Deploy a commit-pinned standalone Next.js image and a private PostgreSQL 17 service under `/srv/tajam`, then add one scoped Apache proxy route after direct loopback verification. Keep Netlify and Neon unchanged as rollback sources.

**Tech Stack:** Next.js 16.3, React 19, NextAuth 4, Node 22, PostgreSQL 17, Docker Compose, Apache httpd, PowerShell/OpenSSH, Vitest.

**Runtime naming:** At execution time set `$backupStamp = Get-Date -Format "yyyyMMdd-HHmmss"` and `$releaseCommit = (git rev-parse --verify HEAD).Trim()` in PowerShell. On the server use the same values as shell variables `backup_stamp` and `release_commit`. Every dynamic path below uses these named values rather than an unspecified name.

---

### Task 1: Add a canonical application-path helper

**Files:**
- Create: `src/lib/app-path.ts`
- Create: `tests/app-path.test.ts`

- [ ] **Step 1: Write failing path tests**

```ts
import { describe, expect, it } from "vitest";
import { normalizeBasePath, withBasePath } from "../src/lib/app-path";

describe("application base path", () => {
  it("keeps local root paths unchanged", () => {
    expect(withBasePath("/api/content", "")).toBe("/api/content");
  });
  it("prefixes production paths exactly once", () => {
    expect(withBasePath("/api/content", "/tajam-fti")).toBe("/tajam-fti/api/content");
    expect(withBasePath("/tajam-fti/login", "/tajam-fti")).toBe("/tajam-fti/login");
  });
  it("normalizes a configured prefix", () => {
    expect(normalizeBasePath("tajam-fti/")).toBe("/tajam-fti");
    expect(() => normalizeBasePath("https://example.com/tajam")).toThrow();
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails because the module is missing**

Run: `npx vitest run tests/app-path.test.ts`

- [ ] **Step 3: Implement the pure helper and build-time wrapper**

```ts
export function normalizeBasePath(value = "") {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.includes("://") || trimmed.includes("?") || trimmed.includes("#"))
    throw new Error("Base path TAJAM tidak valid.");
  const path = `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
  if (path === "/" || path.includes("//"))
    throw new Error("Base path TAJAM tidak valid.");
  return path;
}

export function withBasePath(path: string, basePath: string) {
  const base = normalizeBasePath(basePath);
  const target = path.startsWith("/") ? path : `/${path}`;
  if (!base || target === base || target.startsWith(`${base}/`)) return target;
  return `${base}${target}`;
}

export const APP_BASE_PATH = normalizeBasePath(
  process.env.NEXT_PUBLIC_TAJAM_BASE_PATH ?? "",
);
export const appPath = (path: string) => withBasePath(path, APP_BASE_PATH);
```

- [ ] **Step 4: Run `npx vitest run tests/app-path.test.ts` and confirm all tests pass**

- [ ] **Step 5: Commit the helper**

```text
git add src/lib/app-path.ts tests/app-path.test.ts
git commit -m "feat: add TAJAM application path helper"
```

### Task 2: Make Next.js and NextAuth base-path aware

**Files:**
- Modify: `next.config.ts`
- Create: `src/components/auth-provider.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/lib/auth.ts`
- Modify: `src/components/login-button.tsx`
- Modify: `src/components/planner.tsx`
- Modify: `src/components/member-manager.tsx`
- Modify: `src/components/organization-manager.tsx`
- Test: `tests/app-path.test.ts`

- [ ] **Step 1: Extend path tests with representative login and auth paths**

```ts
expect(withBasePath("/", "/tajam-fti")).toBe("/tajam-fti/");
expect(withBasePath("/login", "/tajam-fti")).toBe("/tajam-fti/login");
expect(withBasePath("/api/auth", "/tajam-fti")).toBe("/tajam-fti/api/auth");
expect(withBasePath("/api/admin/members", "/tajam-fti")).toBe(
  "/tajam-fti/api/admin/members",
);
```

- [ ] **Step 2: Configure Next.js using the server-side build variable**

```ts
import type { NextConfig } from "next";
const rawBasePath = process.env.TAJAM_BASE_PATH?.trim() ?? "";
const basePath = rawBasePath
  ? `/${rawBasePath.replace(/^\/+|\/+$/g, "")}`
  : "";
const config: NextConfig = {
  basePath,
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  devIndicators: false,
};
export default config;
```

- [ ] **Step 3: Add a client auth provider and wrap the application body**

```tsx
// src/components/auth-provider.tsx
"use client";
import { SessionProvider } from "next-auth/react";
import { appPath } from "@/lib/app-path";
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider basePath={appPath("/api/auth")}>{children}</SessionProvider>;
}
```

Use this body in `src/app/layout.tsx`:

```tsx
return (
  <html lang="id">
    <body>
      <AuthProvider>{children}</AuthProvider>
    </body>
  </html>
);
```

- [ ] **Step 4: Replace internal absolute paths**

Import `appPath` and apply it to server redirects, `authOptions.pages`, login/logout callback URLs, `window.location.assign`, every browser request to TAJAM APIs, and the two admin managers. Leave user-provided publication URLs unchanged.

Representative replacements:

```ts
redirect(appPath("/login"));
pages: { signIn: appPath("/login"), error: appPath("/login") };
await signIn("google", { callbackUrl: appPath("/") });
await fetch(appPath("/api/content"), options);
```

- [ ] **Step 5: Run focused tests and type checking**

Run: `npx vitest run tests/app-path.test.ts tests/access.test.ts tests/api.test.ts`

Run: `npm run typecheck`

- [ ] **Step 6: Commit base-path wiring**

```text
git add next.config.ts src/app src/components src/lib/auth.ts tests/app-path.test.ts
git commit -m "feat: support TAJAM production base path"
```

### Task 3: Exercise the base path in the cloud integration check

**Files:**
- Modify: `scripts/check-cloud.mjs`
- Modify: `.env.example`
- Modify: `docs/deployment.md`

- [ ] **Step 1: Update the cloud checker to derive public URLs from the configured prefix**

Add:

```js
const appBasePath = process.env.TAJAM_BASE_PATH || "";
const publicBase = base + appBasePath;
const authBase = `${publicBase}/api/auth`;
```

Pass these server variables:

```js
TAJAM_BASE_PATH: appBasePath,
NEXT_PUBLIC_TAJAM_BASE_PATH: appBasePath,
NEXTAUTH_URL: authBase,
```

Use `publicBase + path` for probes. Keep the `Origin` header equal to the origin-only `base`, because browser origins never include a path.

- [ ] **Step 2: Document the new variables and exact production URLs**

Add to `.env.example`:

```dotenv
TAJAM_BASE_PATH=
NEXT_PUBLIC_TAJAM_BASE_PATH=
```

Document `/tajam-fti`, `NEXTAUTH_URL=https://lab1.trisakti.ac.id/tajam-fti/api/auth`, and the Google callback URI.

- [ ] **Step 3: Build and run all repository checks in root mode**

Run: `npm test`

Run: `npm run typecheck`

Run: `npm run build`

- [ ] **Step 4: Build with production prefix and inspect generated routes/assets**

PowerShell:

```powershell
$env:TAJAM_BASE_PATH = "/tajam-fti"
$env:NEXT_PUBLIC_TAJAM_BASE_PATH = "/tajam-fti"
npm run build
Remove-Item Env:TAJAM_BASE_PATH
Remove-Item Env:NEXT_PUBLIC_TAJAM_BASE_PATH
```

Confirm the build exits successfully and the standalone output exists.

- [ ] **Step 5: Commit tests and documentation**

```text
git add scripts/check-cloud.mjs .env.example docs/deployment.md
git commit -m "test: verify TAJAM base-path deployment"
```

### Task 4: Add isolated container deployment artifacts

**Files:**
- Create: `.dockerignore`
- Create: `deploy/Dockerfile`
- Create: `deploy/compose.yaml`
- Create: `deploy/apache-tajam-fti.conf`
- Create: `deploy/README.md`
- Modify: `.gitignore`
- Test: `tests/deployment.test.ts`

- [ ] **Step 1: Write deployment artifact tests before creating artifacts**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("self-hosted deployment artifacts", () => {
  const compose = readFileSync("deploy/compose.yaml", "utf8");
  const apache = readFileSync("deploy/apache-tajam-fti.conf", "utf8");
  it("keeps the application and PostgreSQL isolated", () => {
    expect(compose).toContain('"127.0.0.1:18011:3000"');
    expect(compose).toContain("/srv/tajam/data/postgres:/var/lib/postgresql/data");
    expect(compose).toContain("/srv/tajam/shared/app.env");
    expect(compose).toContain("/srv/tajam/shared/postgres.env");
    expect(compose.match(/healthcheck:/g)).toHaveLength(2);
    expect(compose).not.toMatch(/5432:5432/);
  });
  it("preserves the application prefix through Apache", () => {
    expect(apache).toContain(
      "ProxyPass        /tajam-fti/ http://127.0.0.1:18011/tajam-fti/",
    );
    expect(apache).toContain(
      "ProxyPassReverse /tajam-fti/ http://127.0.0.1:18011/tajam-fti/",
    );
  });
});
```

- [ ] **Step 2: Run `npx vitest run tests/deployment.test.ts` and confirm missing-file failures**

- [ ] **Step 3: Create the multi-stage standalone image**

`deploy/Dockerfile`:

```dockerfile
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder
ARG TAJAM_BASE_PATH=/tajam-fti
ENV TAJAM_BASE_PATH=$TAJAM_BASE_PATH
ENV NEXT_PUBLIC_TAJAM_BASE_PATH=$TAJAM_BASE_PATH
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 tajam && useradd --system --uid 1001 --gid tajam tajam
COPY --from=builder --chown=tajam:tajam /app/.next/standalone ./
COPY --from=builder --chown=tajam:tajam /app/.next/static ./.next/static
COPY --from=builder --chown=tajam:tajam /app/scripts ./scripts
COPY --from=builder --chown=tajam:tajam /app/db ./db
USER tajam
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 4: Create the Compose stack**

`deploy/compose.yaml`:

```yaml
name: tajam
services:
  tajam-db:
    image: postgres:17-bookworm
    container_name: tajam-db
    restart: unless-stopped
    env_file:
      - /srv/tajam/shared/postgres.env
    volumes:
      - /srv/tajam/data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 10s
      timeout: 5s
      retries: 12
    mem_limit: 1g
    cpus: 2
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }
    networks: [tajam-private]

  tajam-app:
    build:
      context: ..
      dockerfile: deploy/Dockerfile
      args:
        TAJAM_BASE_PATH: /tajam-fti
    image: tajam-fti:${TAJAM_IMAGE_TAG:?TAJAM_IMAGE_TAG wajib diatur}
    container_name: tajam-app
    restart: unless-stopped
    env_file:
      - /srv/tajam/shared/app.env
    ports:
      - "127.0.0.1:18011:3000"
    depends_on:
      tajam-db:
        condition: service_healthy
    healthcheck:
      test:
        - CMD
        - node
        - -e
        - fetch('http://127.0.0.1:3000/tajam-fti/login',{redirect:'manual'}).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))
      interval: 15s
      timeout: 5s
      retries: 12
    mem_limit: 768m
    cpus: 2
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }
    networks: [tajam-private]

networks:
  tajam-private:
    name: tajam-private
```

Create `.dockerignore` with `.git`, `.next`, `node_modules`, `.env*`, `data`, test output, local backups, and remote attachments. Add `.tajam-production/` to `.gitignore` even though the operational directory normally lives outside the repository.

- [ ] **Step 5: Create the Apache fragment and deployment runbook**

The fragment is:

```apache
# BEGIN TAJAM FTI
RedirectMatch 302 ^/tajam-fti$ /tajam-fti/
ProxyPass        /tajam-fti/ http://127.0.0.1:18011/tajam-fti/ nocanon connectiontimeout=5 timeout=60 retry=0
ProxyPassReverse /tajam-fti/ http://127.0.0.1:18011/tajam-fti/
# END TAJAM FTI
```

The runbook specifies permissions, backup paths, exact probes, rollback, and that existing Docker networks/services must remain untouched.

- [ ] **Step 6: Run deployment tests and build the image locally**

Run: `npx vitest run tests/deployment.test.ts`

Run: `docker build -f deploy/Dockerfile --build-arg TAJAM_BASE_PATH=/tajam-fti -t tajam-fti:local .`

- [ ] **Step 7: Commit deployment artifacts**

```text
git add .dockerignore .gitignore deploy tests/deployment.test.ts
git commit -m "feat: add isolated TAJAM container deployment"
```

### Task 5: Stage production configuration without exposing secrets

**Files:**
- Local ignored file: `.env.neon.local`
- Local ignored file: `.env.production.local`
- Server file: `/srv/tajam/shared/postgres.env`
- Server file: `/srv/tajam/shared/app.env`

- [ ] **Step 1: Obtain current values through an authenticated Netlify/Neon session**

Populate `.env.neon.local` with `NEON_DATABASE_URL` and `.env.production.local` with the current `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALENDAR_ID`. Do not paste values into chat or terminal output.

- [ ] **Step 2: Validate only presence and safe metadata**

Check that required keys are non-empty, `NEXTAUTH_SECRET` is at least 32 characters, and the Neon host uses TLS. Print key names and boolean results only.

- [ ] **Step 3: Generate a dedicated PostgreSQL password locally**

Generate 32 random bytes as base64url. Write `POSTGRES_DB=tajam`, `POSTGRES_USER=tajam`, and the generated value to `postgres.env`. Build the private Compose hostname URL for `DATABASE_URL` in `app.env`; add the four Google/NextAuth values, `NEXTAUTH_URL=https://lab1.trisakti.ac.id/tajam-fti/api/auth`, and both base-path variables.

- [ ] **Step 4: Create server directories and transfer configuration with restrictive permissions**

Create `/srv/tajam/{releases,shared,data/postgres,backups/neon}` as root. Copy the two runtime env files, set owner `root:root`, mode `0600`, and set the PostgreSQL data directory owner to container UID/GID `999:999` with mode `0700`.

- [ ] **Step 5: Verify remote permissions and print only variable names**

Use `stat` and `sed -n 's/^\([A-Z0-9_]*\)=.*/\1/p'`; never display values.

### Task 6: Create and verify the Neon backup

**Files:**
- Local backup: outside Git under a timestamped restricted directory
- Server backup: `/srv/tajam/backups/neon/$backup_stamp-neon.dump`

- [ ] **Step 1: Record count-only Neon inventory**

Use `psql` with `NEON_DATABASE_URL` and one query returning counts for the seven application tables plus migration version names. Do not select payloads, emails, secrets, or audit values.

- [ ] **Step 2: Create a PostgreSQL 17 custom dump**

Run `pg_dump --format=custom --no-owner --no-acl --file "$backupStamp-neon.dump"` using the URL from the ignored file. Fail if `pg_restore --list "$backupStamp-neon.dump"` cannot read the archive.

- [ ] **Step 3: Create and verify SHA-256**

Write `$backupStamp-neon.dump.sha256`, re-hash the file, and require an exact match.

- [ ] **Step 4: Transfer backup and checksum to the server**

Use SCP with the verified root key. Set owner `root:root`, dump mode `0600`, checksum mode `0600`, and verify the checksum again on the server.

### Task 7: Restore PostgreSQL and prove data parity

**Files:**
- Server release: `/srv/tajam/releases/$release_commit`
- Server Compose file: `/srv/tajam/current/deploy/compose.yaml`
- Server PostgreSQL data: `/srv/tajam/data/postgres`

- [ ] **Step 1: Transfer a commit-pinned clean source archive**

Require a clean tracked tree, create `git archive` for `$releaseCommit`, transfer it, extract under `/srv/tajam/releases/$release_commit`, and atomically point `/srv/tajam/current` to it.

- [ ] **Step 2: Validate Compose and start only PostgreSQL**

Run `docker compose --env-file /srv/tajam/shared/postgres.env config --quiet`, then start `tajam-db`. Wait on the health status rather than a fixed sleep.

- [ ] **Step 3: Restore into the empty `tajam` database**

Use `pg_restore --exit-on-error --clean --if-exists --no-owner --no-acl` inside the PostgreSQL container. Stop immediately on a nonzero exit.

- [ ] **Step 4: Run repository migrations once against the restored database**

Run the migration script from an ephemeral app image connected to the TAJAM Compose network. Run it a second time to prove idempotence.

- [ ] **Step 5: Compare count-only inventory**

Require exact matches for content, organization, members, audit entries, calendar jobs, and migration versions. Also compare member counts grouped by role/scope and calendar jobs grouped by sync status without printing member addresses or content.

### Task 8: Build and probe TAJAM before touching Apache

**Files:**
- Server image: `tajam-fti:$release_commit`
- Server app service: `tajam-app`

- [ ] **Step 1: Build the commit-pinned app image with `/tajam-fti`**

Run Compose build and inspect the resulting image labels/ID. Do not use `latest` as the only tag.

- [ ] **Step 2: Start the app and wait for its health check**

Require PostgreSQL healthy first. Confirm only `127.0.0.1:18011` is published and no PostgreSQL port appears in `ss -lnt`.

- [ ] **Step 3: Probe direct loopback behavior**

Require:

- `/tajam-fti/login` returns 200;
- `/tajam-fti/_next/` assets referenced by the login HTML return 200;
- `/tajam-fti/api/content` returns 401 without a session;
- `/login` and `/api/content` do not become alternate public application roots.

- [ ] **Step 4: Inspect container logs for secrets and startup errors**

Review bounded recent logs. Stop if credentials appear, database migration errors occur, or the health status is not healthy.

### Task 9: Update Google OAuth and Apache, then cut over

**Files:**
- Google OAuth redirect configuration
- Server: `/etc/httpd/conf.d/zz-lab1-trisakti-ssl.conf`
- Backup: timestamped sibling of the active Apache file

- [ ] **Step 1: Add the production OAuth redirect URI**

Add exactly `https://lab1.trisakti.ac.id/tajam-fti/api/auth/callback/google` to the existing Google OAuth client. Preserve the Netlify callback during rollback validation.

- [ ] **Step 2: Capture baseline health**

Record HTTP status and container health for LabHub and Siklusa. Record the checksum of the active Apache file.

- [ ] **Step 3: Back up and patch Apache idempotently**

Copy the active file to a timestamped backup. Insert the reviewed marker block before the virtual host closing tag only if it is absent.

- [ ] **Step 4: Validate and gracefully reload Apache**

Run `httpd -t`; only on `Syntax OK`, run `systemctl reload httpd`. Do not restart Docker or existing applications.

- [ ] **Step 5: Verify public routing and regressions**

Require HTTPS login and assets under `/tajam-fti/`, an OAuth authorization redirect containing the new callback, and unchanged baseline results for LabHub and Siklusa.

### Task 10: Perform final data cutover and acceptance verification

**Files:**
- Final timestamped Neon dump and checksum
- Deployment record: `/srv/tajam/shared/deployment-record.txt`

- [ ] **Step 1: Announce and begin the short write-free window**

Ensure team members stop writing through Netlify. Capture a final Neon count inventory.

- [ ] **Step 2: Repeat the dump, checksum, transfer, clean restore, and parity checks**

The final dump supersedes the rehearsal dump. Do not continue if any count or migration version differs.

- [ ] **Step 3: Restart only the TAJAM app and run authenticated checks**

With an allowed account, verify login, admin/scoped-editor access, content listing, Excel import/export, and Google Calendar synchronization using one reversible test item.

- [ ] **Step 4: Recheck existing applications and server resources**

Confirm LabHub and Siklusa health matches baseline, no failed systemd units appeared, PostgreSQL has no host listener, and memory/disk remain within the audited capacity.

- [ ] **Step 5: Record the accepted release**

Write commit ID, image ID, dump checksum, database counts, Apache backup path, verification time, and rollback commands to the root-only deployment record. Keep Netlify and Neon unchanged pending separate decommission approval.

- [ ] **Step 6: Commit final operational documentation and push reviewed code**

Run all repository checks again, commit any verified runbook refinements, push `main`, and report exact verification evidence and remaining rollback sources.
