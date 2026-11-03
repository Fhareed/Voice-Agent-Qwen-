import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/api";

// Send a password-reset email. Always returns ok (never reveals if the email exists).
export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body.email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }
  try {
    const r = await fetch(`${BACKEND_URL}/auth/forgot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email }),
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json({ error: data.detail || "Couldn't send the email." }, { status: r.status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Can't reach the backend right now." }, { status: 502 });
  }
}
