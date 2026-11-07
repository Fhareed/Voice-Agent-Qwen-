import { redirect } from "next/navigation";
import {
  AdminForbiddenError,
  AdminSessionError,
  AuthError,
  fetchAdminMetrics,
  getSession,
} from "@/lib/api";
import type { Session } from "@/lib/types";

// Server-side admin gate. Anonymous callers are bounced to /login; a signed-in
// non-admin yields { session, forbidden: true } so the page can render
// <AdminGate/>. The real protection is the backend: every /admin/* endpoint
// requires a valid session whose email is on ADMIN_EMAILS, so data never reaches
// the browser without it — this just drives the UI.
export async function requireAdmin(): Promise<{ session: Session; forbidden: boolean }> {
  const session = getSession();
  if (!session.token) redirect("/login");
  try {
    await fetchAdminMetrics(session);
    return { session, forbidden: false };
  } catch (e) {
    if (e instanceof AuthError) redirect("/api/auth/logout");
    if (e instanceof AdminSessionError) redirect("/app/admin/login");
    if (e instanceof AdminForbiddenError) return { session, forbidden: true };
    // Other errors (e.g. backend down): let the page render and surface its own
    // load error rather than masquerading as "not an admin".
    return { session, forbidden: false };
  }
}
