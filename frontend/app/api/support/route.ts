import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/api";

// Customer support channel: list this org's threads (GET) and open a new one
// (POST). Both proxy to the backend with the session; the backend scopes to the
// caller's org.
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
    const r = await fetch(`${BACKEND_URL}/support/threads`, {
      headers: { Authorization: `Bearer ${token}`, "X-Org-Id": org },
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 || r.status === 403) {
      return NextResponse.json(
        { error: data.detail || data.error || "Your session expired — please sign in again.", authExpired: true },
        { status: r.status },
      );
    }
    if (!r.ok) {
      return NextResponse.json({ error: data.detail || data.error || "Could not load messages." }, { status: r.status });
    }
    return NextResponse.json({ threads: data.threads ?? [] });
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
    const r = await fetch(`${BACKEND_URL}/support/threads`, {
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
    if (r.status === 401 || r.status === 403) {
      return NextResponse.json(
        { error: data.detail || data.error || "Your session expired — please sign in again.", authExpired: true },
        { status: r.status },
      );
    }
    if (!r.ok) {
      return NextResponse.json({ error: data.detail || data.error || "Could not send your message." }, { status: r.status });
    }
    return NextResponse.json({ ok: true, thread: data.thread ?? null });
  } catch {
    return NextResponse.json({ error: "Can't reach the backend right now." }, { status: 502 });
  }
}
