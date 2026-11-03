import { redirect } from "next/navigation";
import { AuthError, fetchSettings, fetchSetupStatus, getSession, type Settings, type SetupStatus } from "@/lib/api";
import NeedOrg from "@/components/NeedOrg";
import OnboardingView from "@/components/OnboardingView";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = getSession();
  if (!session.token) redirect("/login");
  if (!session.org) return <NeedOrg />;

  // A customer who already paid must never see the onboarding form again.
  let status: SetupStatus | null = null;
  try {
    status = await fetchSetupStatus(session);
  } catch (e) {
    if (e instanceof AuthError) redirect("/api/auth/logout");
  }
  if (status) {
    // Already provisioned/onboarded → dashboard. Paid but not yet provisioned →
    // the finish-setup hub, never the form again (that would re-charge).
    if (status.onboarded || status.has_agent) redirect("/app");
    else if (status.paid) redirect("/app/welcome");
  }

  let settings: Settings = {};
  try {
    settings = await fetchSettings(session);
  } catch (e) {
    if (e instanceof AuthError) redirect("/api/auth/logout");
  }

  return <OnboardingView settings={settings} orgName={session.orgName} />;
}
