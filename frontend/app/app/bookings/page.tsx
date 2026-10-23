import { redirect } from "next/navigation";
import { AuthError, fetchBookings, getSession } from "@/lib/api";
import BookingsView from "@/components/BookingsView";
import NeedOrg from "@/components/NeedOrg";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const session = getSession();
  if (!session.token) redirect("/login");
  if (!session.org) return <NeedOrg />;

  let bookings: Booking[] = [];
  let loadError = false;
  try {
    bookings = await fetchBookings(session);
  } catch (e) {
    if (e instanceof AuthError) redirect("/login");
    loadError = true;
  }

  return <BookingsView bookings={bookings} orgName={session.orgName} loadError={loadError} />;
}
