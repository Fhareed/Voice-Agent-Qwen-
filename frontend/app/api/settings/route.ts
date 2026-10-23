import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/api";

// Save org settings: proxies PATCH /settings to the backend with the session.
export async function PATCH(req: Request) {
  const c = cookies();
  const token = c.get("ld_token")?.value;
  const org = c.get("ld_org")?.value;
  if (!token || !org) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const r = await fetch(`${BACKEND_URL}/settings`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Org-Id": org,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json({ error: data.error || "Could not save settings." }, { status: r.status });
    }
    return NextResponse.json({ ok: true, settings: data.settings ?? {} });
  } catch {
    return NextResponse.json({ error: "Can't reach the backend right now." }, { status: 502 });
  }
}
