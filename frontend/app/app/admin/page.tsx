import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AdminForbiddenError,
  AuthError,
  fetchAdminOrgs,
  getSession,
  type AdminOrg,
} from "@/lib/api";
import AdminView from "@/components/AdminView";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = getSession();
  if (!session.token) redirect("/login");

  let orgs: AdminOrg[] = [];
  let forbidden = false;
  let loadError = false;
  try {
    orgs = await fetchAdminOrgs(session);
  } catch (e) {
    if (e instanceof AuthError) redirect("/api/auth/logout");
    if (e instanceof AdminForbiddenError) forbidden = true;
    else loadError = true;
  }

  if (forbidden) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream px-6">
        <div className="max-w-md rounded-2xl border border-[#E7E6EC] bg-white p-8 text-center shadow-[0_10px_28px_rgba(23,23,23,0.06)]">
          <h1 className="font-display text-[22px] font-bold text-[#161616]">Admin only</h1>
          <p className="mt-2 text-[14px] text-[#6B6B70]">
            This page is for the Lumidesk team. Your account isn&apos;t on the admin list.
          </p>
          <p className="mt-3 text-[12.5px] text-[#8E8E92]">
            To grant access, add your login email to <code className="rounded bg-[#F2F3F5] px-1.5 py-0.5">ADMIN_EMAILS</code> in the backend <code className="rounded bg-[#F2F3F5] px-1.5 py-0.5">.env</code>.
          </p>
          <Link href="/app" className="mt-5 inline-block rounded-full bg-cobalt px-5 py-2.5 font-display text-[14px] font-bold text-white">
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  return <AdminView orgs={orgs} loadError={loadError} />;
}
