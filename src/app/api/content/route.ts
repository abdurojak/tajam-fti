import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/database";
import { calendarCredentials, requireAccess } from "@/lib/auth";
import { syncCalendarJobs } from "@/lib/calendar-service";
import { fail, mutationAllowed, readJson } from "@/lib/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const authorization = await requireAccess("read");
    if ("response" in authorization) return authorization.response;
    return NextResponse.json(await (await getDatabase()).list(authorization.access), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: Request) {
  try {
    const authorization = await requireAccess("write");
    if ("response" in authorization) return authorization.response;
    const blocked = mutationAllowed(request);
    if (blocked) return blocked;
    const database = await getDatabase();
    const saved = await database.create(await readJson(request), authorization.access);
    if (saved.calendarSync.status === "disabled")
      return NextResponse.json(saved, { status: 201 });
    const auth = await calendarCredentials(request);
    if ("error" in auth) {
      await database.markCalendarFailed(saved.id, auth.error, false);
      return NextResponse.json({ ...saved, calendarSync: { status: "failed", error: auth.error } }, { status: 201 });
    }
    const batch = await syncCalendarJobs({ ids: [saved.id], access: authorization.access, credentials: auth.credentials });
    const sync = batch.results[0];
    return NextResponse.json({ ...saved, calendarSync: sync ? { status: sync.status, error: sync.error } : saved.calendarSync }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
