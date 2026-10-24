import { redirect } from "next/navigation";
import { AuthError, fetchBookings, fetchCalls, getSession } from "@/lib/api";
import DashboardView from "@/components/DashboardView";
import NeedOrg from "@/components/NeedOrg";
import type { Booking, Call } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = getSession();
  if (!session.token) redirect("/login");
  if (!session.org) return <NeedOrg />;

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
