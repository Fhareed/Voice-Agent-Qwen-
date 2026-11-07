import { redirect } from "next/navigation";
import {
  AdminForbiddenError,
  AdminSessionError,
  AuthError,
  fetchAdminOrgs,
  getSession,
  type AdminOrg,
} from "@/lib/api";
import AdminGate from "@/components/admin/AdminGate";
import BusinessesView from "@/components/admin/BusinessesView";

export const dynamic = "force-dynamic";

export default async function AdminBusinessesPage() {
  const session = getSession();
  if (!session.token) redirect("/login");

  let orgs: AdminOrg[] = [];
  let loadError = false;
  try {
    orgs = await fetchAdminOrgs(session);
  } catch (e) {
    if (e instanceof AuthError) redirect("/api/auth/logout");
    if (e instanceof AdminSessionError) redirect("/app/admin/login");
    if (e instanceof AdminForbiddenError) return <AdminGate />;
    loadError = true;
  }

  return <BusinessesView orgs={orgs} loadError={loadError} />;
}
