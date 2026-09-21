import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/database";
import { calendarCredentials, requireAccess } from "@/lib/auth";
import { syncCalendarJobs } from "@/lib/calendar-service";
import { fail, mutationAllowed, readJson } from "@/lib/api";
import { accessMode } from "@/lib/access";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  try {
    const authorization = await requireAccess("write");
    if ("response" in authorization) return authorization.response;
    const blocked = mutationAllowed(request);
    if (blocked) return blocked;
    const { id } = await context.params;
    const database = await getDatabase();
    const row = await database.update(id, await readJson(request), authorization.access);
    if (row && row.calendarSync.status !== "disabled") {
      const auth = await calendarCredentials(request);
      if ("error" in auth) {
        await database.markCalendarFailed(id, auth.error, false);
        row.calendarSync = { status: "failed", error: auth.error };
      } else {
        const batch = await syncCalendarJobs({ ids: [id], access: authorization.access, credentials: auth.credentials });
        const sync = batch.results[0];
        if (sync) row.calendarSync = { status: sync.status, error: sync.error };
      }
    }
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
    const authorization = await requireAccess("write");
    if ("response" in authorization) return authorization.response;
    const blocked = mutationAllowed(request);
    if (blocked) return blocked;
    const { id } = await context.params;
    const database = await getDatabase();
    const removed = await database.remove(id, authorization.access);
    if (removed) {
      if (accessMode() === "local") return NextResponse.json({ ok: true, calendarSync: null });
      const auth = await calendarCredentials(request);
      if ("error" in auth) {
        await database.markCalendarFailed(id, auth.error, false);
        return NextResponse.json({ ok: true, calendarSync: { status: "failed", error: auth.error } });
      }
      const batch = await syncCalendarJobs({ ids: [id], access: authorization.access, credentials: auth.credentials });
      const sync = batch.results[0];
      return NextResponse.json({ ok: true, calendarSync: sync ? { status: sync.status, error: sync.error } : null });
    }
    return NextResponse.json(
      { error: "Konten tidak ditemukan." },
      { status: 404 },
    );
  } catch (error) {
    return fail(error);
  }
}
