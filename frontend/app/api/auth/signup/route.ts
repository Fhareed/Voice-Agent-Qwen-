import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/api";

const secure = process.env.NODE_ENV === "production";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days (middleware keeps the access token fresh)

export async function POST(req: Request) {
  let body: { email?: string; password?: string; business?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = (body.email || "").trim();
  const password = body.password || "";
  const business = (body.business || "").trim();
  const name = (body.name || "").trim();
  if (!email || !password || !business) {
    return NextResponse.json({ error: "Email, password and business name are required." }, { status: 400 });
  }

  // 1) Create the auth user.
  try {
    const su = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
      cache: "no-store",
    });
    const sd = await su.json().catch(() => ({}));
    if (!su.ok) {
      return NextResponse.json({ error: sd.detail || sd.error || "Could not create the account." }, { status: su.status });
    }
  } catch {
    return NextResponse.json({ error: "Can't reach the backend. Is the API running?" }, { status: 502 });
  }

  // 2) Try to log in immediately. If the project requires email confirmation,
  //    the login fails with an "email not confirmed" error and we route the user
  //    to the "check your email" screen. Any OTHER failure (backend unreachable,
  //    bad gateway, an unexpected login error) must NOT masquerade as a
  //    confirmation step — otherwise we'd tell the user to check an email that was
  //    never sent (e.g. when email confirmation is turned off).
  let token: string | undefined;
  let refresh: string | undefined;
  let loginReachable = true;
  let loginData: { access_token?: string; refresh_token?: string; detail?: string; error?: string } = {};
  let loginStatus = 0;
  try {
    const li = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    loginStatus = li.status;
    loginData = await li.json().catch(() => ({}));
    if (li.ok) {
      token = loginData.access_token;
      refresh = loginData.refresh_token;
    }
  } catch {
    loginReachable = false;
  }

  if (!token) {
    // Only an explicit "email not confirmed" response is a confirmation step.
    const loginMsg = String(loginData.detail || loginData.error || "");
    if (loginReachable && /confirm/i.test(loginMsg)) {
      return NextResponse.json({ ok: true, needsConfirmation: true });
    }
    // Otherwise the account was created but we couldn't start a session — surface
    // a real error rather than a misleading "check your email".
    if (!loginReachable) {
      return NextResponse.json(
        { error: "Your account was created, but we couldn't reach the backend to sign you in. Please try logging in." },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: loginMsg || "Your account was created, but we couldn't sign you in. Please try logging in." },
      { status: loginStatus >= 400 ? loginStatus : 500 },
    );
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
  res.cookies.set("ld_token", token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: SESSION_MAX_AGE });
  if (refresh) {
    res.cookies.set("ld_refresh", refresh, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: SESSION_MAX_AGE });
  }
  if (orgId) {
    res.cookies.set("ld_org", orgId, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: SESSION_MAX_AGE });
    res.cookies.set("ld_org_name", orgName, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: SESSION_MAX_AGE });
  }
  return res;
}
