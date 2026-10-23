import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/api";

const secure = process.env.NODE_ENV === "production";
const MAX_AGE = 60 * 60 * 8;

export async function POST(req: Request) {
  let body: { email?: string; password?: string; business?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = (body.email || "").trim();
  const password = body.password || "";
  const business = (body.business || "").trim();
  if (!email || !password || !business) {
    return NextResponse.json({ error: "Email, password and business name are required." }, { status: 400 });
  }

  // 1) Create the auth user.
  try {
    const su = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    const sd = await su.json().catch(() => ({}));
    if (!su.ok) {
      return NextResponse.json({ error: sd.error || "Could not create the account." }, { status: su.status });
    }
  } catch {
    return NextResponse.json({ error: "Can't reach the backend. Is the API running?" }, { status: 502 });
  }

  // 2) Try to log in immediately. If the project requires email confirmation,
  //    this fails and we tell the user to confirm first.
  let token: string | undefined;
  try {
    const li = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    if (li.ok) {
      const ld = await li.json();
      token = ld.access_token;
    }
  } catch {
    /* fall through to confirmation path */
  }
  if (!token) {
    return NextResponse.json({ ok: true, needsConfirmation: true });
  }

  // 3) Create their organization and set the session.
  let orgId: string | undefined;
  let orgName = business;
  try {
    const or = await fetch(`${BACKEND_URL}/orgs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: business }),
      cache: "no-store",
    });
    if (or.ok) {
      const od = await or.json();
      orgId = od.org_id;
      orgName = od.name ?? business;
    }
  } catch {
    /* org creation can be retried in-app */
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("ld_token", token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: MAX_AGE });
  if (orgId) {
    res.cookies.set("ld_org", orgId, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: MAX_AGE });
    res.cookies.set("ld_org_name", orgName, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: MAX_AGE });
  }
  return res;
}
