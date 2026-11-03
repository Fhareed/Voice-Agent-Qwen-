import { redirect } from "next/navigation";
import { AuthError, fetchNumbers, getSession, type NumberRow } from "@/lib/api";
import NeedOrg from "@/components/NeedOrg";
import NumberView from "@/components/NumberView";

export const dynamic = "force-dynamic";

export default async function NumbersPage() {
  const session = getSession();
  if (!session.token) redirect("/login");
  if (!session.org) return <NeedOrg />;

  let numbers: NumberRow[] = [];
  let loadError = false;
  try {
    numbers = await fetchNumbers(session);
  } catch (e) {
    if (e instanceof AuthError) redirect("/api/auth/logout");
    loadError = true;
  }

  return <NumberView numbers={numbers} orgName={session.orgName} loadError={loadError} />;
}
