import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/api";

const secure = process.env.NODE_ENV === "production";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  // 1) Exchange credentials for an access token with the FastAPI backend.
  let loginRes: Response;
  try {
    loginRes = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "Can't reach the backend. Is the API running on " + BACKEND_URL + "?" },
      { status: 502 },
    );
  }

  const loginData = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok) {
    return NextResponse.json(
      { error: loginData.error || "Login failed." },
      { status: loginRes.status },
    );
  }
  const token: string | undefined = loginData.access_token;
  if (!token) {
    return NextResponse.json({ error: "Login failed — no token returned." }, { status: 401 });
  }
  const refresh: string | undefined = loginData.refresh_token;

  // 2) Look up the org(s) this user belongs to. A brief transient is common
  //    right after login, so retry once before concluding the user has no org.
  let orgs: Array<{ org_id: string; name: string; role: string }> = [];
  let orgsLoaded = false;
  for (let attempt = 0; attempt < 2 && !orgsLoaded; attempt++) {
    try {
      const orgRes = await fetch(`${BACKEND_URL}/orgs`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (orgRes.ok) {
        const orgData = await orgRes.json();
        orgs = orgData.orgs ?? [];
        orgsLoaded = true;
      }
    } catch {
      // Non-fatal — retry once, then the user can create an org next.
    }
  }

  // Only treat the user as needing an org when we actually confirmed they have none.
  const needOrg = orgsLoaded && orgs.length === 0;

  const res = NextResponse.json({ ok: true, needOrg, orgsLoaded, orgs });
  res.cookies.set("ld_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  if (refresh) {
    res.cookies.set("ld_refresh", refresh, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
  }
  if (orgs[0]) {
    res.cookies.set("ld_org", orgs[0].org_id, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    res.cookies.set("ld_org_name", orgs[0].name ?? "", {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
  }
  return res;
}
