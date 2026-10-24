import { redirect } from "next/navigation";
import { getSession } from "@/lib/api";
import WelcomeView from "@/components/WelcomeView";

export const dynamic = "force-dynamic";

export default function WelcomePage({ searchParams }: { searchParams: { session_id?: string } }) {
  const session = getSession();
  if (!session.token) redirect("/login");
  return <WelcomeView sessionId={searchParams.session_id ?? null} />;
}
