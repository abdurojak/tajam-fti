import Planner from "@/components/planner";
import { redirect } from "next/navigation";
import { accessMode } from "@/lib/access";
import { currentAccess } from "@/lib/auth";
import { getDatabase } from "@/lib/database";
import { accessSummary, localAdminAccess } from "@/lib/organization";
export const dynamic = "force-dynamic";
export default async function Home() {
  const local = accessMode() === "local";
  const access = local ? localAdminAccess() : await currentAccess();
  if (!access) redirect("/login");
  const summary = accessSummary(access, await (await getDatabase()).organization());
  return (
    <Planner
      cloud={!!process.env.DATABASE_URL}
      access={summary}
    />
  );
}
