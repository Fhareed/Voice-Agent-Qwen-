import AdminGate from "@/components/admin/AdminGate";
import SupportInbox from "@/components/admin/SupportInbox";
import { requireAdmin } from "@/components/admin/guard";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
  const { forbidden } = await requireAdmin();
  if (forbidden) return <AdminGate />;
  return <SupportInbox />;
}
