import { cookies } from "next/headers";
import type { Booking, Call, Org, Session } from "./types";

/**
 * The FastAPI backend base URL. Server-side only — this is never shipped to the
 * browser, so the browser never talks to FastAPI directly (no CORS, no token in
 * client JS). Defaults to the local dev server.
 */
export const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

const TOKEN_COOKIE = "ld_token";
const ORG_COOKIE = "ld_org";
const ORG_NAME_COOKIE = "ld_org_name";

export function getSession(): Session {
  const c = cookies();
  return {
    token: c.get(TOKEN_COOKIE)?.value ?? null,
    org: c.get(ORG_COOKIE)?.value ?? null,
    orgName: c.get(ORG_NAME_COOKIE)?.value ?? null,
  };
}

function authHeaders(session: Session): Record<string, string> {
  const h: Record<string, string> = {};
  if (session.token) h["Authorization"] = `Bearer ${session.token}`;
  if (session.org) h["X-Org-Id"] = session.org;
  return h;
}

export class AuthError extends Error {}

async function backendGet<T>(path: string, session: Session): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: authHeaders(session),
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) {
    throw new AuthError(`Not authorized for ${path}`);
  }
  if (!res.ok) {
    throw new Error(`Backend ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchCalls(session: Session): Promise<Call[]> {
  const data = await backendGet<{ calls: Call[] }>("/calls", session);
  return data.calls ?? [];
}

export async function fetchBookings(session: Session): Promise<Booking[]> {
  const data = await backendGet<{ bookings: Booking[] }>("/bookings", session);
  return data.bookings ?? [];
}

export async function fetchOrgs(session: Session): Promise<Org[]> {
  const data = await backendGet<{ orgs: Org[] }>("/orgs", session);
  return data.orgs ?? [];
}

export type Settings = Record<string, unknown>;

export async function fetchSettings(session: Session): Promise<Settings> {
  const data = await backendGet<{ settings: Settings }>("/settings", session);
  return data.settings ?? {};
}

// ── Admin (founder-only) ──────────────────────────────────────────
export interface AdminOrg {
  org_id: string;
  name: string;
  created_at: string | null;
  owner_email: string | null;
  settings: Settings;
  calls: number;
  bookings: number;
}

/** Thrown when the backend returns 403 — logged in, but not an admin. */
export class AdminForbiddenError extends Error {}

export async function fetchAdminOrgs(session: Session): Promise<AdminOrg[]> {
  const res = await fetch(`${BACKEND_URL}/admin/orgs`, {
    headers: authHeaders(session),
    cache: "no-store",
  });
  if (res.status === 403) throw new AdminForbiddenError("Admin access only.");
  if (res.status === 401) throw new AuthError("Not authorized for /admin/orgs");
  if (!res.ok) throw new Error(`Backend /admin/orgs failed: ${res.status}`);
  const data = (await res.json()) as { orgs: AdminOrg[] };
  return data.orgs ?? [];
}
