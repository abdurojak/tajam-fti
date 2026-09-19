import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/auth";
import { getDatabase } from "@/lib/database";
import { accessSummary } from "@/lib/organization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await requireAccess("read");
  if ("response" in authorization) return authorization.response;
  const database = await getDatabase();
  return NextResponse.json(
    accessSummary(authorization.access, await database.organization()),
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
