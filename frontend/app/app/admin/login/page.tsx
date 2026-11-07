import { redirect } from "next/navigation";
import { getSession } from "@/lib/api";
import AdminLogin from "@/components/admin/AdminLogin";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  const session = getSession();
  // Must be signed into the app first; the backend also checks the email
  // allowlist when the password is submitted.
  if (!session.token) redirect("/login");
  return <AdminLogin />;
}
