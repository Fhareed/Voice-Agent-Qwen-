import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/api";

// Admin password login: forwards the password to the backend (which checks it
// against ADMIN_PASSWORD for an allowlisted, logged-in user) and, on success,
// stores the returned signed token in an HttpOnly cookie. The token is never
// exposed to client JS.
export async function POST(req: Request) {
  const token = cookies().get("ld_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const r = await fetch(`${BACKEND_URL}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password: body.password ?? "" }),
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json(
        { error: data.detail || data.error || "Admin login failed." },
        { status: r.status },
      );
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set("ld_admin", String(data.token ?? ""), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Number(data.expires_in) || 43200,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Can't reach the backend right now." }, { status: 502 });
  }
}
