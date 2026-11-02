import { redirect } from "next/navigation";
import { AuthError, fetchCampaigns, getSession, type OutboundCampaignSummary } from "@/lib/api";
import NeedOrg from "@/components/NeedOrg";
import OutboundView from "@/components/OutboundView";

export const dynamic = "force-dynamic";

export default async function OutboundPage() {
  const session = getSession();
  if (!session.token) redirect("/login");
  if (!session.org) return <NeedOrg />;

  let campaigns: OutboundCampaignSummary[] = [];
  let loadError = false;
  try {
    campaigns = await fetchCampaigns(session);
  } catch (e) {
    if (e instanceof AuthError) redirect("/api/auth/logout");
    loadError = true;
  }

  return <OutboundView campaigns={campaigns} orgName={session.orgName} loadError={loadError} />;
}
