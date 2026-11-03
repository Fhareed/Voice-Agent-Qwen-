import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Auth + session refresh.
//
// Public: "/" (marketing), "/login", "/signup". Protected: everything under "/app".
// Supabase access tokens expire ~1h, but we keep a long-lived refresh token in an
// httpOnly cookie (ld_refresh). When the access token is missing or about to
// expire, we exchange the refresh token for a fresh session via the backend and
// re-set the cookies — so an open dashboard doesn't silently die mid-session.
//
// Cookie-forwarding note: on a refresh we mutate the REQUEST cookies and pass the
// request to NextResponse.next() so the downstream page/handler sees the fresh
// token on THIS request, and we also set the cookies on the RESPONSE so the
// browser keeps them. Concurrent refreshes (a page firing several API calls at
// once) are covered by Supabase's refresh-token reuse interval.

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE,
};
const AUTH_COOKIES = ["ld_token", "ld_refresh", "ld_org", "ld_org_name"];

// Decode a JWT's `exp` (seconds) without verifying — the backend still verifies
// the signature on every real call; this is only to decide when to refresh.
function jwtExp(token: string | undefined): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    let p = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (p.length % 4) p += "=";
    const payload = JSON.parse(atob(p));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApp = pathname === "/app" || pathname.startsWith("/app/");
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isAuthApi = pathname.startsWith("/api/auth/"); // login/refresh/logout/… — never refresh around these

  let token = req.cookies.get("ld_token")?.value;
  const refresh = req.cookies.get("ld_refresh")?.value;

  // refreshed: a fresh session we obtained this request. refreshFailed: the
  // refresh token was explicitly rejected (session is dead), vs. a transient
  // network blip where we keep the existing token and try again next time.
  let refreshed: { access_token: string; refresh_token?: string } | null = null;
  let refreshFailed = false;

  if (!isAuthApi && refresh) {
    const exp = jwtExp(token);
    const now = Math.floor(Date.now() / 1000);
    const needsRefresh = !token || exp === null || exp <= now + 60; // 60s skew
    if (needsRefresh) {
      try {
        const r = await fetch(`${BACKEND_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refresh }),
          cache: "no-store",
        });
        if (r.ok) {
          const d = await r.json().catch(() => ({}));
          if (d?.access_token) {
            refreshed = { access_token: d.access_token, refresh_token: d.refresh_token };
            token = d.access_token;
          } else {
            refreshFailed = true;
            token = undefined;
          }
        } else {
          // Explicit rejection (e.g. 401) — the refresh token is no longer valid.
          refreshFailed = true;
          token = undefined;
        }
      } catch {
        // Transient (backend unreachable): keep whatever token we had; don't nuke
        // the session over a blip. A still-valid token keeps working; an expired
        // one falls through to the protection check below.
      }
    }
  }

  // Protected area with no usable session → login (clear dead cookies on the way).
  if (isApp && !token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    const res = NextResponse.redirect(url);
    if (refreshFailed) for (const c of AUTH_COOKIES) res.cookies.delete(c);
    return res;
  }

  // Already signed in but on an auth page → straight to the app.
  if (isAuthPage && token) {
    const url = req.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  // Forward the (possibly refreshed) token to the downstream handler, and persist
  // the new cookies to the browser.
  if (refreshed) {
    req.cookies.set("ld_token", refreshed.access_token);
    if (refreshed.refresh_token) req.cookies.set("ld_refresh", refreshed.refresh_token);
  }
  const res = NextResponse.next({ request: req });
  if (refreshed) {
    res.cookies.set("ld_token", refreshed.access_token, COOKIE_OPTS);
    if (refreshed.refresh_token) res.cookies.set("ld_refresh", refreshed.refresh_token, COOKIE_OPTS);
  } else if (refreshFailed) {
    for (const c of AUTH_COOKIES) res.cookies.delete(c);
  }
  return res;
}

export const config = {
  // Run on everything except Next's static assets — INCLUDING /api, so client
  // API calls get a refreshed token too (auth endpoints are skipped in-handler).
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
