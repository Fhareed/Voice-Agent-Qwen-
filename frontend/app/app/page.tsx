import { redirect } from "next/navigation";
import { AuthError, fetchBookings, fetchCalls, fetchSettings, getSession } from "@/lib/api";
import DashboardView from "@/components/DashboardView";
import NeedOrg from "@/components/NeedOrg";
import type { Booking, Call } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = getSession();
  if (!session.token) redirect("/login");
  if (!session.org) return <NeedOrg />;

  // New users finish onboarding first (which also provisions their agent).
  let onboarded = true;
  try {
    const settings = await fetchSettings(session);
    onboarded = !!settings.onboarded;
  } catch (e) {
    if (e instanceof AuthError) redirect("/api/auth/logout");
    // If settings can't load, don't block the dashboard.
  }
  if (!onboarded) redirect("/app/onboarding");

  let calls: Call[] = [];
  let bookings: Booking[] = [];
  let loadError = false;
  try {
    [calls, bookings] = await Promise.all([fetchCalls(session), fetchBookings(session)]);
  } catch (e) {
    if (e instanceof AuthError) redirect("/api/auth/logout");
    loadError = true;
  }

  return (
    <DashboardView calls={calls} bookings={bookings} orgName={session.orgName} loadError={loadError} />
  );
}
