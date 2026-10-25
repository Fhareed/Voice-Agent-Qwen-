import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/api";

// Call actions, proxied to the backend with the signed-in session.
//   PATCH  /api/calls/:id   -> resolve / unresolve   (body: { status })
//   DELETE /api/calls/:id   -> remove the call from the dashboard

function session() {
  const c = cookies();
  return { token: c.get("ld_token")?.value, org: c.get("ld_org")?.value };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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
    const r = await fetch(`${BACKEND_URL}/calls/${encodeURIComponent(params.id)}`, {
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
      return NextResponse.json({ error: data.error || "Could not update the call." }, { status: r.status });
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
    const r = await fetch(`${BACKEND_URL}/calls/${encodeURIComponent(params.id)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Org-Id": org,
      },
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json({ error: data.error || "Could not delete the call." }, { status: r.status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Can't reach the backend right now." }, { status: 502 });
  }
}
