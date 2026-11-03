import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/api";

// Complete a password reset: verify the recovery session and set the new password.
export async function POST(req: Request) {
  let body: { access_token?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body.access_token || !body.password) {
    return NextResponse.json({ error: "A reset link and a new password are required." }, { status: 400 });
  }
  try {
    const r = await fetch(`${BACKEND_URL}/auth/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json({ error: data.detail || "Couldn't reset your password." }, { status: r.status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Can't reach the backend right now." }, { status: 502 });
  }
}
