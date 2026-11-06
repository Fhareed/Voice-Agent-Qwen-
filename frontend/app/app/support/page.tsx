import { redirect } from "next/navigation";
import { getSession } from "@/lib/api";
import NeedOrg from "@/components/NeedOrg";
import SupportView from "@/components/SupportView";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const session = getSession();
  if (!session.token) redirect("/login");
  if (!session.org) return <NeedOrg />;

  return <SupportView orgName={session.orgName} />;
}
