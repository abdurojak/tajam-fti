import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseMode } from "../src/lib/runtime-config";
import {
  isEmailAllowed,
  googleSignInAllowed,
  accessMode,
  authConfigurationReady,
} from "../src/lib/access";
import { mutationAllowed } from "../src/lib/api";
afterEach(() => vi.unstubAllEnvs());
describe("cloud access", () => {
  it("uses PostgreSQL when configured, never falls back to SQLite on Netlify", () => {
    expect(databaseMode({ DATABASE_URL: "postgresql://example" })).toBe(
      "postgres",
    );
    expect(databaseMode({})).toBe("sqlite");
    expect(() => databaseMode({ NETLIFY: "true" })).toThrow("DATABASE_URL");
  });
  it("requires auth on hosted or database-connected installs", () => {
    expect(accessMode({ NETLIFY: "true" })).toBe("google");
    expect(accessMode({ DATABASE_URL: "postgresql://example" })).toBe("google");
    expect(accessMode({ GOOGLE_CLIENT_ID: "client" })).toBe("google");
    expect(accessMode({})).toBe("local");
  });
  it("matches exact emails and denies an empty allowlist", () => {
    expect(
      isEmailAllowed(" A@Example.com ", "a@example.com,b@example.com"),
    ).toBe(true);
    expect(isEmailAllowed("a@example.com.evil", "a@example.com")).toBe(false);
    expect(isEmailAllowed("someone@example.com", "")).toBe(false);
  });
  it("requires Google verified identity and an allowed address", () => {
    expect(
      googleSignInAllowed(
        "google",
        { email: "a@example.com", email_verified: true },
        "a@example.com",
      ),
    ).toBe(true);
    expect(
      googleSignInAllowed(
        "google",
        { email: "a@example.com", email_verified: false },
        "a@example.com",
      ),
    ).toBe(false);
    expect(
      googleSignInAllowed(
        "other",
        { email: "a@example.com", email_verified: true },
        "a@example.com",
      ),
    ).toBe(false);
  });
  it("fails closed for incomplete auth settings or insecure cloud origin", () => {
    expect(authConfigurationReady({ NETLIFY: "true" })).toBe(false);
    const env = {
      NETLIFY: "true",
      NEXTAUTH_URL: "https://tajam.example",
      NEXTAUTH_SECRET: "x".repeat(40),
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
      ALLOWED_EMAILS: "a@example.com",
    };
    expect(authConfigurationReady(env)).toBe(true);
    expect(
      authConfigurationReady({ ...env, NEXTAUTH_URL: "http://tajam.example" }),
    ).toBe(false);
    expect(authConfigurationReady({ ...env, ALLOWED_EMAILS: "" })).toBe(false);
  });
  it("checks the configured HTTPS origin behind a serverless proxy", () => {
    vi.stubEnv("NEXTAUTH_URL", "https://tajam.example");
    expect(
      mutationAllowed(
        new Request("http://localhost/api/content", {
          method: "POST",
          headers: {
            origin: "https://tajam.example",
            host: "localhost",
            "content-type": "application/json",
          },
        }),
      ),
    ).toBeNull();
    expect(
      mutationAllowed(
        new Request("http://localhost/api/content", {
          method: "POST",
          headers: {
            origin: "https://evil.example",
            host: "evil.example",
            "content-type": "application/json",
          },
        }),
      )?.status,
    ).toBe(403);
  });
});
