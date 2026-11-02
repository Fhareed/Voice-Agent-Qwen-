import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/api";

// List + create outbound campaigns, proxied to the backend with the session.
//   GET  /api/outbound/campaigns   -> list
//   POST /api/outbound/campaigns   -> create (body: { name, goal, script, targets[] })

function session() {
  const c = cookies();
  return { token: c.get("ld_token")?.value, org: c.get("ld_org")?.value };
}

export async function GET() {
  const { token, org } = session();
  if (!token || !org) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  try {
    const r = await fetch(`${BACKEND_URL}/outbound/campaigns`, {
      headers: { Authorization: `Bearer ${token}`, "X-Org-Id": org },
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json({ error: data.detail || "Couldn't load campaigns." }, { status: r.status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Can't reach the backend right now." }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const { token, org } = session();
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
    const r = await fetch(`${BACKEND_URL}/outbound/campaigns`, {
      method: "POST",
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
      return NextResponse.json({ error: data.detail || "Couldn't create the campaign." }, { status: r.status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Can't reach the backend right now." }, { status: 502 });
  }
}
