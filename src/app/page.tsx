import Planner from "@/components/planner";
import { redirect } from "next/navigation";
import { accessMode } from "@/lib/access";
import { currentMember } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function Home() {
  const local = accessMode() === "local";
  const member = local ? null : await currentMember();
  if (!local && !member) redirect("/login");
  return (
    <Planner
      cloud={!!process.env.DATABASE_URL}
      memberEmail={member?.email ?? undefined}
    />
  );
}
