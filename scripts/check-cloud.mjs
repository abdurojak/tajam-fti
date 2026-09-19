import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { encode } from "next-auth/jwt";
if (!process.env.TEST_DATABASE_URL)
  throw new Error(
    "TEST_DATABASE_URL harus menunjuk database pengujian terpisah.",
  );
const base = "http://127.0.0.1:3307";
const secret = randomBytes(48).toString("base64url");
// Test-only OAuth settings and locally signed cookies. Production always uses Google.
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3307",
  ],
  {
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      NETLIFY: "",
      AWS_LAMBDA_FUNCTION_NAME: "",
      VERCEL: "",
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      NEXTAUTH_URL: base,
      NEXTAUTH_SECRET: secret,
      GOOGLE_CLIENT_ID: "test-client",
      GOOGLE_CLIENT_SECRET: "test-only",
    },
  },
);
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
const ids = [];
const good = await encode({
  secret,
  token: {
    email: "labtif.fti@trisakti.ac.id",
    name: "Test member",
    teamVerified: true,
  },
  maxAge: 600,
});
async function call(path, { method = "GET", body, token, origin = base } = {}) {
  return fetch(base + path, {
    method,
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      origin,
      ...(token ? { cookie: `next-auth.session-token=${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const payload = {
  prodi: "Teknik Mesin",
  activity: "Cloud integration test",
  idea: `Cloud ${randomBytes(8).toString("hex")}`,
  category: "Useful",
  status: "Draf",
  eventDate: "2026-09-22",
  uploadDate: "2026-09-23",
  format: "Poster",
  channel: "Website",
  pic: "Test",
  link: "",
  notes: "Disposable test",
};
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null)
      throw new Error("Test server exited before it was ready.");
    try {
      if ((await fetch(base + "/login")).status === 200) {
        ready = true;
        break;
      }
    } catch {}
    await delay(250);
  }
  assert.ok(ready, "test server ready");
  assert.equal((await call("/")).status, 307);
  for (const [path, method, body] of [
    ["/api/content", "GET"],
    ["/api/content", "POST", payload],
    ["/api/content/missing", "PUT", payload],
    ["/api/content/missing", "DELETE"],
    ["/api/import", "POST", [payload]],
  ]) {
    assert.equal(
      (await call(path, { method, body })).status,
      401,
      `${method} ${path} must require login`,
    );
  }
  const rejected = await encode({
    secret,
    token: { email: "outsider@example.com", teamVerified: true },
    maxAge: 600,
  });
  const unverified = await encode({
    secret,
    token: { email: "labtif.fti@trisakti.ac.id" },
    maxAge: 600,
  });
  const expired = await encode({
    secret,
    token: { email: "labtif.fti@trisakti.ac.id", teamVerified: true },
    maxAge: -3600,
  });
  for (const token of [rejected, unverified, expired, "tampered-cookie"])
    assert.equal((await call("/api/content", { token })).status, 401);
  assert.equal((await call("/", { token: good })).status, 200);
  const initialResponse = await call("/api/content", { token: good });
  assert.match(initialResponse.headers.get("cache-control"), /no-store/);
  const initial = (await initialResponse.json()).length;
  assert.equal(
    (
      await call("/api/content", {
        method: "POST",
        body: payload,
        token: good,
        origin: "https://evil.example",
      })
    ).status,
    403,
  );
  const created = await call("/api/content", {
    method: "POST",
    body: payload,
    token: good,
  });
  assert.equal(created.status, 201);
  const row = await created.json();
  ids.push(row.id);
  const updated = await call(`/api/content/${row.id}`, {
    method: "PUT",
    body: { ...payload, status: "Terbit" },
    token: good,
  });
  assert.equal((await updated.json()).status, "Terbit");
  const imported = { ...payload, idea: payload.idea + " import" };
  const results = await Promise.all(
    [1, 2].map(async () =>
      (
        await call("/api/import", {
          method: "POST",
          body: [imported, imported],
          token: good,
        })
      ).json(),
    ),
  );
  assert.equal(
    results.reduce((total, r) => total + r.added, 0),
    1,
  );
  let all = await (await call("/api/content", { token: good })).json();
  ids.push(all.find((x) => x.idea === imported.idea).id);
  assert.equal(
    (
      await call("/api/import", {
        method: "POST",
        body: [
          { ...payload, idea: "rollback " + payload.idea },
          { ...payload, pic: "" },
        ],
        token: good,
      })
    ).status,
    400,
  );
  all = await (await call("/api/content", { token: good })).json();
  assert.equal(all.length, initial + 2);
  assert.equal(
    (await call("/api/content/missing", { method: "DELETE", token: good }))
      .status,
    404,
  );
  console.log(
    "PASS: protected page and all API routes; allowed, disallowed, expired and tampered sessions; no-store; CSRF; PostgreSQL CRUD; concurrent import; atomic validation.",
  );
} finally {
  for (const id of ids)
    await call(`/api/content/${id}`, { method: "DELETE", token: good }).catch(
      () => {},
    );
  server.kill();
}
