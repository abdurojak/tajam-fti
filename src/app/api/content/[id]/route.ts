import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/database";
import { requireMember } from "@/lib/auth";
import { fail, mutationAllowed, readJson } from "@/lib/api";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  try {
    const blocked = (await requireMember()) || mutationAllowed(request);
    if (blocked) return blocked;
    const { id } = await context.params;
    const row = await (await getDatabase()).update(id, await readJson(request));
    return row
      ? NextResponse.json(row)
      : NextResponse.json(
          { error: "Konten tidak ditemukan." },
          { status: 404 },
        );
  } catch (error) {
    return fail(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    const blocked = (await requireMember()) || mutationAllowed(request);
    if (blocked) return blocked;
    const { id } = await context.params;
    return (await (await getDatabase()).remove(id))
      ? NextResponse.json({ ok: true })
      : NextResponse.json(
          { error: "Konten tidak ditemukan." },
          { status: 404 },
        );
  } catch (error) {
    return fail(error);
  }
}
