import NextAuth from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { authConfigurationReady } from "@/lib/access";
export const runtime = "nodejs";
const handler = NextAuth(authOptions);
async function auth(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> },
) {
  if (!authConfigurationReady())
    return NextResponse.json(
      { error: "Login Google belum dikonfigurasi." },
      { status: 503 },
    );
  return handler(request, context);
}
export { auth as GET, auth as POST };
