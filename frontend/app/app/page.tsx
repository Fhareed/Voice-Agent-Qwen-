import { redirect } from "next/navigation";
import { AuthError, fetchBookings, fetchCalls, fetchSettings, fetchSetupStatus, getSession, type SetupStatus, type Settings } from "@/lib/api";
import DashboardView from "@/components/DashboardView";
import NeedOrg from "@/components/NeedOrg";
import type { Booking, Call } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = getSession();
  if (!session.token) redirect("/login");
  if (!session.org) return <NeedOrg />;

  // Where is this org in setup? New users finish onboarding (and pay) first;
  // paid-but-not-provisioned users go to the finish-setup hub.
  let status: SetupStatus | null = null;
  try {
    status = await fetchSetupStatus(session);
  } catch (e) {
    if (e instanceof AuthError) redirect("/api/auth/logout");
    // If status can't load, don't block the dashboard — fall through and render.
  }
  // Render the dashboard as soon as they have a live agent OR are marked onboarded
  // (either is enough — relying on has_agent too keeps this loop-proof if the
  // onboarded flag is ever stale). Only redirect when neither is true.
  if (status && !status.onboarded && !status.has_agent) {
    // Paid but their agent never provisioned → the finish-setup hub (no re-pay).
    if (status.paid) redirect("/app/welcome");
    // Otherwise they still need to complete onboarding + checkout.
    else redirect("/app/onboarding");
  }

  let calls: Call[] = [];
  let bookings: Booking[] = [];
  let settings: Settings = {};
  let loadError = false;
  try {
    [calls, bookings, settings] = await Promise.all([
      fetchCalls(session),
      fetchBookings(session),
      fetchSettings(session).catch(() => ({} as Settings)),
    ]);
  } catch (e) {
    if (e instanceof AuthError) redirect("/api/auth/logout");
    loadError = true;
  }

  return (
    <DashboardView
      calls={calls}
      bookings={bookings}
      orgName={session.orgName}
      loadError={loadError}
      ready={status?.ready}
      hasAgent={status?.has_agent}
      hasNumber={status?.has_number}
      paid={status?.paid}
      settings={settings}
    />
  );
}
