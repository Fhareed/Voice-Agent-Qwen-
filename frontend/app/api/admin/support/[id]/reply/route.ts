import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/api";

// Founder-only: add a reply to one support thread. Proxies to the backend with
// the session token; the backend enforces ADMIN_EMAILS. `id` is the thread id.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const token = cookies().get("ld_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const r = await fetch(`${BACKEND_URL}/admin/support/${encodeURIComponent(params.id)}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) {
      return NextResponse.json(
        { error: data.detail || data.error || "Your session expired — please sign in again.", authExpired: true },
        { status: r.status },
      );
    }
    if (!r.ok) {
      return NextResponse.json({ error: data.detail || data.error || "Could not send your reply." }, { status: r.status });
    }
    return NextResponse.json({ ok: true, thread: data.thread ?? null });
  } catch {
    return NextResponse.json({ error: "Can't reach the backend right now." }, { status: 502 });
  }
}
