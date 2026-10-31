import { redirect } from "next/navigation";
import { AuthError, fetchCalendar, getSession, type CalendarStatus } from "@/lib/api";
import NeedOrg from "@/components/NeedOrg";
import CalendarView from "@/components/CalendarView";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const session = getSession();
  if (!session.token) redirect("/login");
  if (!session.org) return <NeedOrg />;

  let status: CalendarStatus = {
    connected: false,
    calendar_id: "",
    service_account_email: "",
    service_account_ready: false,
  };
  let loadError = false;
  try {
    status = await fetchCalendar(session);
  } catch (e) {
    if (e instanceof AuthError) redirect("/api/auth/logout");
    loadError = true;
  }

  return <CalendarView status={status} orgName={session.orgName} loadError={loadError} />;
}
