import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/api";

// Smart one-click: reuse the org agent's existing number, or buy one; then map it.
function session() {
  const c = cookies();
  return { token: c.get("ld_token")?.value, org: c.get("ld_org")?.value };
}

export async function POST() {
  const { token, org } = session();
  if (!token || !org) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  try {
    const r = await fetch(`${BACKEND_URL}/numbers/provision`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "X-Org-Id": org },
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: data.detail || "Couldn't set up your number." }, { status: r.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Can't reach the backend right now." }, { status: 502 });
  }
}
