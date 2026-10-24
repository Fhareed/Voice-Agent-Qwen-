import { redirect } from "next/navigation";
import { AuthError, fetchSettings, getSession, type Settings } from "@/lib/api";
import NeedOrg from "@/components/NeedOrg";
import SettingsView from "@/components/SettingsView";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = getSession();
  if (!session.token) redirect("/login");
  if (!session.org) return <NeedOrg />;

  let settings: Settings = {};
  let loadError = false;
  try {
    settings = await fetchSettings(session);
  } catch (e) {
    if (e instanceof AuthError) redirect("/api/auth/logout");
    loadError = true;
  }

  return (
    <SettingsView
      settings={settings}
      orgName={session.orgName}
      loadError={loadError}
    />
  );
}
