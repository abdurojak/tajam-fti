import { isHosted } from "./runtime-config";
type Environment = Record<string, string | undefined>;
export function accessMode(env: Environment = process.env): "local" | "google" {
  return isHosted(env) ||
    env.DATABASE_URL?.trim() ||
    env.GOOGLE_CLIENT_ID ||
    env.NEXTAUTH_SECRET ||
    env.NEXTAUTH_URL
    ? "google"
    : "local";
}
export function isEmailAllowed(
  email: unknown,
  allowlist = process.env.ALLOWED_EMAILS ?? "",
) {
  if (typeof email !== "string" || !email.trim()) return false;
  const allowed = allowlist
    .split(/[\s,;]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}
export function googleSignInAllowed(
  provider: unknown,
  profile: unknown,
  allowlist?: string,
) {
  if (provider !== "google" || !profile || typeof profile !== "object")
    return false;
  const google = profile as { email?: unknown; email_verified?: unknown };
  return (
    google.email_verified === true && isEmailAllowed(google.email, allowlist)
  );
}
export function authConfigurationReady(env: Environment = process.env) {
  if (
    !env.GOOGLE_CLIENT_ID ||
    !env.GOOGLE_CLIENT_SECRET ||
    (env.NEXTAUTH_SECRET?.length ?? 0) < 32 ||
    !env.ALLOWED_EMAILS?.trim()
  )
    return false;
  try {
    const url = new URL(env.NEXTAUTH_URL ?? "");
    return (
      url.pathname === "/" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (url.protocol === "https:" ||
        (!isHosted(env) &&
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname)))
    );
  } catch {
    return false;
  }
}
