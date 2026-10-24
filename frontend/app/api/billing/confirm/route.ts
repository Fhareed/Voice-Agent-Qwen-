import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/api";

// After Stripe redirects back: verify the session is paid and provision.
export async function POST(req: Request) {
  const c = cookies();
  const token = c.get("ld_token")?.value;
  const org = c.get("ld_org")?.value;
  if (!token || !org) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  let body: { session_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const r = await fetch(`${BACKEND_URL}/billing/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Org-Id": org },
      body: JSON.stringify({ session_id: body.session_id }),
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json({ error: data.detail || data.error || "Could not confirm payment." }, { status: r.status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Can't reach the backend right now." }, { status: 502 });
  }
}
