import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// The admin console lands on Metrics.
export default function AdminIndexPage() {
  redirect("/app/admin/metrics");
}
