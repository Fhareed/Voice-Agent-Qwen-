import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/api";

// Import an existing number over SIP (bring-your-own / Twilio / carrier).
function session() {
  const c = cookies();
  return { token: c.get("ld_token")?.value, org: c.get("ld_org")?.value };
}

export async function POST(req: Request) {
  const { token, org } = session();
  if (!token || !org) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const r = await fetch(`${BACKEND_URL}/numbers/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "X-Org-Id": org, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: data.detail || "Couldn't import that number." }, { status: r.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Can't reach the backend right now." }, { status: 502 });
  }
}
