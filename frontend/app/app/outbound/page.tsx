import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AuthError,
  fetchCampaigns,
  fetchSettings,
  getSession,
  type OutboundCampaignSummary,
  type Settings,
} from "@/lib/api";
import NeedOrg from "@/components/NeedOrg";
import OutboundView from "@/components/OutboundView";
import Sidebar from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function OutboundPage() {
  const session = getSession();
  if (!session.token) redirect("/login");
  if (!session.org) return <NeedOrg />;

  // Outbound calling is a paid add-on — gate the feature on the entitlement.
  let settings: Settings = {};
  try {
    settings = await fetchSettings(session);
  } catch (e) {
    if (e instanceof AuthError) redirect("/api/auth/logout");
  }
  const entitled = settings.outbound === true;

  if (!entitled) {
    return (
      <div className="panel">
        <Sidebar active="outbound" orgName={session.orgName} outboundEnabled={false} />
        <main className="content">
          <div className="top">
            <div className="greet">
              <h1>Outbound</h1>
              <div className="sub">
                Let LumiDesk make the calls — campaigns, confirmations, follow-ups and lead
                qualification.
              </div>
            </div>
          </div>
          <div className="kbcard" style={{ maxWidth: 560 }}>
            <h2 className="kbhead">Outbound calling</h2>
            <p className="kbhint" style={{ marginBottom: 16 }}>
              Outbound calling is an add-on (+€99/mo). Add it to your plan to create campaigns and
              let LumiDesk ring your lists automatically.
            </p>
            <Link
              className="kbbtn"
              href="/app/onboarding"
              style={{ display: "inline-block", textDecoration: "none" }}
            >
              Enable outbound
            </Link>
          </div>
        </main>
      </div>
    );
  }

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
