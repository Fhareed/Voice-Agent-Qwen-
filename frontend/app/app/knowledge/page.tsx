import { redirect } from "next/navigation";
import { AuthError, fetchKb, getSession, type KbStatus } from "@/lib/api";
import NeedOrg from "@/components/NeedOrg";
import KnowledgeView from "@/components/KnowledgeView";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const session = getSession();
  if (!session.token) redirect("/login");
  if (!session.org) return <NeedOrg />;

  let kb: KbStatus = { has_kb: false, sources: [] };
  let loadError = false;
  try {
    kb = await fetchKb(session);
  } catch (e) {
    if (e instanceof AuthError) redirect("/api/auth/logout");
    loadError = true;
  }

  return <KnowledgeView kb={kb} orgName={session.orgName} loadError={loadError} />;
}
