import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { NextResponse } from "next/server";
import {
  accessMode,
  authConfigurationReady,
  googleSignInAllowed,
  isEmailAllowed,
} from "./access";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: { scope: "openid email profile", prompt: "select_account" },
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ account, profile }) {
      return (
        authConfigurationReady() &&
        googleSignInAllowed(account?.provider, profile)
      );
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.teamVerified = googleSignInAllowed(account.provider, profile);
        token.email = profile?.email?.trim().toLowerCase();
      }
      return token;
    },
    async session({ session, token }) {
      // Recheck membership on every request; removing an email revokes access
      // even if its signed session cookie has not yet expired.
      if (!token.teamVerified || !isEmailAllowed(token.email))
        session.user = undefined;
      else if (session.user) session.user.email = token.email;
      return session;
    },
  },
  logger: {
    error(code) {
      console.error("Authentication error:", code);
    },
    warn(code) {
      console.warn("Authentication warning:", code);
    },
  },
};

export async function currentMember() {
  if (!authConfigurationReady()) return null;
  const session = await getServerSession(authOptions);
  return session?.user?.email && isEmailAllowed(session.user.email)
    ? session.user
    : null;
}
export async function requireMember() {
  if (accessMode() === "local") return null;
  if (!authConfigurationReady())
    return NextResponse.json(
      { error: "Login tim belum dikonfigurasi. Hubungi pengelola aplikasi." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  if (!(await currentMember()))
    return NextResponse.json(
      { error: "Silakan masuk dengan akun Google anggota tim." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  return null;
}
