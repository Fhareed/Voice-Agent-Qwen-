import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/api";

// Public contact / "book a demo" capture → forwards to FastAPI POST /leads.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const phone = String(body.phone || "").trim();
  if (!name || (!email && !phone)) {
    return NextResponse.json({ error: "A name and an email or phone are required." }, { status: 400 });
  }

  try {
    const res = await fetch(`${BACKEND_URL}/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: String(body.kind || "book"),
        name,
        email,
        phone,
        business: String(body.business || ""),
        website: String(body.website || ""),
        note: String(body.note || ""),
        page: String(body.page || "home"),
        ts: new Date().toISOString(),
      }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: data.error || "Could not send." }, { status: res.status });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Can't reach the backend right now." }, { status: 502 });
  }
}
