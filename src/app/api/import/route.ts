import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/database";
import { requireMember } from "@/lib/auth";
import { fail, mutationAllowed, readJson } from "@/lib/api";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const blocked = (await requireMember()) || mutationAllowed(request);
    if (blocked) return blocked;
    const data = await readJson(request);
    if (!Array.isArray(data) || !data.length || data.length > 5000)
      throw new Error("Kirim 1–5.000 baris konten.");
    return NextResponse.json(await (await getDatabase()).import(data));
  } catch (error) {
    return fail(error);
  }
}
