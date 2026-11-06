import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/api";

// Founder-only: list every support message across all orgs. Proxies to the
// backend with the session token; the backend enforces ADMIN_EMAILS.
export async function GET(req: Request) {
  const token = cookies().get("ld_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const status = new URL(req.url).searchParams.get("status");
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  try {
    const r = await fetch(`${BACKEND_URL}/admin/support${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
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
      return NextResponse.json({ error: data.detail || data.error || "Could not load messages." }, { status: r.status });
    }
    return NextResponse.json({ messages: data.messages ?? [], open_count: data.open_count ?? 0 });
  } catch {
    return NextResponse.json({ error: "Can't reach the backend right now." }, { status: 502 });
  }
}
