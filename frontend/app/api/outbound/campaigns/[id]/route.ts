import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/api";

// One outbound campaign, proxied to the backend with the session.
//   GET    /api/outbound/campaigns/:id   -> detail + targets
//   DELETE /api/outbound/campaigns/:id   -> remove

function session() {
  const c = cookies();
  return { token: c.get("ld_token")?.value, org: c.get("ld_org")?.value };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { token, org } = session();
  if (!token || !org) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  try {
    const r = await fetch(`${BACKEND_URL}/outbound/campaigns/${encodeURIComponent(params.id)}`, {
      headers: { Authorization: `Bearer ${token}`, "X-Org-Id": org },
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json({ error: data.detail || "Couldn't load the campaign." }, { status: r.status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Can't reach the backend right now." }, { status: 502 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { token, org } = session();
  if (!token || !org) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  try {
    const r = await fetch(`${BACKEND_URL}/outbound/campaigns/${encodeURIComponent(params.id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "X-Org-Id": org },
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json({ error: data.detail || "Couldn't delete it." }, { status: r.status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Can't reach the backend right now." }, { status: 502 });
  }
}
