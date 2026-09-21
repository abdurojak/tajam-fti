import { NextResponse } from "next/server";
import { calendarCredentials, requireAccess } from "@/lib/auth";
import { syncCalendarJobs } from "@/lib/calendar-service";
import { fail, mutationAllowed, readJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authorization = await requireAccess("write");
    if ("response" in authorization) return authorization.response;
    const blocked = mutationAllowed(request);
    if (blocked) return blocked;
    const body = (await readJson(request)) as { ids?: unknown; limit?: unknown };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string")
      : [];
    const auth = await calendarCredentials(request);
    if ("error" in auth)
      return NextResponse.json({ error: auth.error }, { status: 409 });
    return NextResponse.json(
      await syncCalendarJobs({
        ids,
        limit: typeof body.limit === "number" ? body.limit : 20,
        access: authorization.access,
        credentials: auth.credentials,
      }),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return fail(error);
  }
}
