import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/auth";
import { fail, mutationAllowed, readJson } from "@/lib/api";
import { getDatabase } from "@/lib/database";
import type { MemberCommand } from "@/lib/organization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authorization = await requireAccess("admin");
    if ("response" in authorization) return authorization.response;
    return NextResponse.json(
      await (await getDatabase()).listAdministration(authorization.access),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const authorization = await requireAccess("admin");
    if ("response" in authorization) return authorization.response;
    const blocked = mutationAllowed(request);
    if (blocked) return blocked;
    return NextResponse.json(
      await (await getDatabase()).saveMember(
        (await readJson(request)) as MemberCommand,
        authorization.access,
      ),
    );
  } catch (error) {
    return fail(error);
  }
}
