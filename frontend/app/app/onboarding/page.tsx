import { redirect } from "next/navigation";
import { AuthError, fetchSettings, getSession, type Settings } from "@/lib/api";
import NeedOrg from "@/components/NeedOrg";
import OnboardingView from "@/components/OnboardingView";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = getSession();
  if (!session.token) redirect("/login");
  if (!session.org) return <NeedOrg />;

  let settings: Settings = {};
  try {
    settings = await fetchSettings(session);
  } catch (e) {
    if (e instanceof AuthError) redirect("/api/auth/logout");
  }

  // Already set up? Straight to the dashboard.
  if (settings.onboarded) redirect("/app");

  return <OnboardingView settings={settings} orgName={session.orgName} />;
}
