import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { accessMode, authConfigurationReady, googleAuthorizationParams, googleSignInAllowed } from "./access";
import { getDatabase } from "./database";
import { localAdminAccess, normalizeEmail, type AccessContext } from "./organization";
import { refreshGoogleAccessToken } from "./google-calendar";

export type CalendarCredentials = { accessToken: string };

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: { params: googleAuthorizationParams() },
    }),
  ],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ account, profile }) {
      if (!authConfigurationReady() || !googleSignInAllowed(account?.provider, profile)) return false;
      const email = typeof profile?.email === "string" ? normalizeEmail(profile.email) : "";
      return !!(email && (await (await getDatabase()).resolveAccess(email)));
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.teamVerified = googleSignInAllowed(account.provider, profile);
        token.email = typeof profile?.email === "string" ? normalizeEmail(profile.email) : undefined;
        token.googleAccessToken = account.access_token;
        token.googleRefreshToken = account.refresh_token ?? token.googleRefreshToken;
        token.googleAccessTokenExpiresAt = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      const email = typeof token.email === "string" ? normalizeEmail(token.email) : "";
      const access = token.teamVerified && email ? await (await getDatabase()).resolveAccess(email) : null;
      if (!access) session.user = undefined;
      else if (session.user) session.user.email = access.email;
      return session;
    },
  },
  logger: {
    error(code) { console.error("Authentication error:", code); },
    warn(code) { console.warn("Authentication warning:", code); },
  },
};

export async function currentAccess(): Promise<AccessContext | null> {
  if (accessMode() === "local") return localAdminAccess();
  if (!authConfigurationReady()) return null;
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  return email ? await (await getDatabase()).resolveAccess(email) : null;
}

export async function currentMember() {
  const access = await currentAccess();
  return access ? { email: access.email } : null;
}

export async function requireAccess(level: "read" | "write" | "admin") {
  if (!authConfigurationReady() && accessMode() !== "local")
    return { response: NextResponse.json(
      { error: "Login tim belum dikonfigurasi. Hubungi pengelola aplikasi." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    ) } as const;
  const access = await currentAccess();
  if (!access)
    return { response: NextResponse.json(
      { error: "Silakan masuk dengan akun Google anggota tim." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    ) } as const;
  if ((level === "write" && access.role === "viewer") || (level === "admin" && access.role !== "admin"))
    return { response: NextResponse.json(
      { error: "Anda tidak memiliki akses untuk tindakan ini." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    ) } as const;
  return { access } as const;
}

export async function requireMember() {
  const result = await requireAccess("read");
  return "response" in result ? result.response : null;
}

export async function calendarCredentials(
  request: Request,
): Promise<{ credentials: CalendarCredentials } | { error: string }> {
  const token = await getToken({
    req: request as never,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token?.googleAccessToken)
    return { error: "Izin Google Calendar belum diberikan. Silakan keluar lalu masuk kembali." };
  const expiresAt = token.googleAccessTokenExpiresAt ?? 0;
  if (expiresAt > Math.floor(Date.now() / 1000) + 60)
    return { credentials: { accessToken: token.googleAccessToken } };
  if (!token.googleRefreshToken)
    return { error: "Izin Google Calendar berakhir. Silakan keluar lalu masuk kembali." };
  try {
    const refreshed = await refreshGoogleAccessToken(token.googleRefreshToken, {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    });
    return { credentials: { accessToken: refreshed.accessToken } };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Izin Google Calendar berakhir. Silakan keluar lalu masuk kembali.",
    };
  }
}
