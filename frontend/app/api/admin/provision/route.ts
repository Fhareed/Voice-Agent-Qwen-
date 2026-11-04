import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/api";

// Founder-only: trigger Retell provisioning for one org. Proxies to the backend
// with the session token; the backend enforces ADMIN_EMAILS.
export async function POST(req: Request) {
  const token = cookies().get("ld_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  let body: { org_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const orgId = (body.org_id || "").trim();
  if (!orgId) {
    return NextResponse.json({ error: "Missing org_id." }, { status: 400 });
  }

  try {
    const r = await fetch(`${BACKEND_URL}/admin/provision/${encodeURIComponent(orgId)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({}));
    // 403 here means "logged in but not an admin", not an expired session, so only
    // a 401 is surfaced as an auth-expiry signal for the client.
    if (r.status === 401) {
      return NextResponse.json(
        { error: data.detail || data.error || "Your session expired — please sign in again.", authExpired: true },
        { status: r.status },
      );
    }
    if (!r.ok) {
      return NextResponse.json(
        { error: data.detail || data.error || "Provisioning failed." },
        { status: r.status },
      );
    }
    return NextResponse.json({ ok: true, ...data });
  } catch {
    return NextResponse.json({ error: "Can't reach the backend right now." }, { status: 502 });
  }
}
