import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/auth";
import { fail, mutationAllowed, readJson } from "@/lib/api";
import { getDatabase } from "@/lib/database";
import type {
  DepartmentCommand,
  StudyProgramCommand,
} from "@/lib/organization";

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
    const body = (await readJson(request)) as {
      entity?: unknown;
      value?: unknown;
    };
    const database = await getDatabase();
    if (body.entity === "department")
      return NextResponse.json(
        await database.saveDepartment(
          body.value as DepartmentCommand,
          authorization.access,
        ),
      );
    if (body.entity === "study_program")
      return NextResponse.json(
        await database.saveStudyProgram(
          body.value as StudyProgramCommand,
          authorization.access,
        ),
      );
    throw new Error("Jenis data organisasi tidak valid.");
  } catch (error) {
    return fail(error);
  }
}
