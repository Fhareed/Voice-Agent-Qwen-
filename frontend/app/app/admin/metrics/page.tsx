import { redirect } from "next/navigation";
import {
  AdminForbiddenError,
  AdminSessionError,
  AuthError,
  fetchAdminMetrics,
  getSession,
  type AdminMetrics,
} from "@/lib/api";
import AdminGate from "@/components/admin/AdminGate";
import MetricsView from "@/components/admin/MetricsView";

export const dynamic = "force-dynamic";

export default async function AdminMetricsPage() {
  const session = getSession();
  if (!session.token) redirect("/login");

  let metrics: AdminMetrics | null = null;
  let loadError = false;
  try {
    metrics = await fetchAdminMetrics(session);
  } catch (e) {
    if (e instanceof AuthError) redirect("/api/auth/logout");
    if (e instanceof AdminSessionError) redirect("/app/admin/login");
    if (e instanceof AdminForbiddenError) return <AdminGate />;
    loadError = true;
  }

  return <MetricsView m={metrics} loadError={loadError} />;
}
