import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/database";
import { requireMember } from "@/lib/auth";
import { fail, mutationAllowed, readJson } from "@/lib/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const blocked = await requireMember();
    if (blocked) return blocked;
    return NextResponse.json(await (await getDatabase()).list(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: Request) {
  try {
    const blocked = (await requireMember()) || mutationAllowed(request);
    if (blocked) return blocked;
    return NextResponse.json(
      await (await getDatabase()).create(await readJson(request)),
      {
        status: 201,
      },
    );
  } catch (error) {
    return fail(error);
  }
}
