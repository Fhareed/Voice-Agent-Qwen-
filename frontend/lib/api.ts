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

// ── Setup status (per org) ─────────────────────────────────────────
export type SetupStatus = {
  paid: boolean;
  onboarded: boolean;
  has_agent: boolean;
  has_number: boolean;
  ready: boolean;
  plan: string | null;
};

export async function fetchSetupStatus(session: Session): Promise<SetupStatus> {
  return backendGet<SetupStatus>("/setup/status", session);
}

// ── Knowledge base (per org) ───────────────────────────────────────
export interface KbSource {
  kind: string; // "file" | "website" | "text"
  name: string;
  chunks: number;
  added_at: string | null;
}

export interface KbStatus {
  has_kb: boolean;
  sources: KbSource[];
}

export async function fetchKb(session: Session): Promise<KbStatus> {
  const data = await backendGet<KbStatus>("/kb", session);
  return { has_kb: !!data.has_kb, sources: data.sources ?? [] };
}

// ── Calendar sync (per org) ────────────────────────────────────────
export interface CalendarStatus {
  connected: boolean;
  calendar_id: string;
  service_account_email: string;
  service_account_ready: boolean;
}

export async function fetchCalendar(session: Session): Promise<CalendarStatus> {
  const d = await backendGet<CalendarStatus>("/calendar", session);
  return {
    connected: !!d.connected,
    calendar_id: d.calendar_id ?? "",
    service_account_email: d.service_account_email ?? "",
    service_account_ready: !!d.service_account_ready,
  };
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

export interface AdminMetrics {
  total_orgs: number;
  new_7d: number;
  new_30d: number;
  total_calls: number;
  total_bookings: number;
  paid: number;
  onboarded: number;
  with_agent: number;
  with_number: number;
  active_7d: number | null;
  total_users: number | null;
  by_plan: Record<string, number>;
  by_country: Record<string, number>;
  by_language: Record<string, number>;
}

export async function fetchAdminMetrics(session: Session): Promise<AdminMetrics | null> {
  const res = await fetch(`${BACKEND_URL}/admin/metrics`, {
    headers: authHeaders(session),
    cache: "no-store",
  });
  if (res.status === 403) throw new AdminForbiddenError("Admin access only.");
  if (res.status === 401) throw new AuthError("Not authorized for /admin/metrics");
  if (!res.ok) return null;
  const data = (await res.json()) as { metrics: AdminMetrics };
  return data.metrics ?? null;
}

// ── Support / contact threads ──────────────────────────────────────
// One continuous two-way conversation = a thread of messages, each from either
// the customer or the LumiDesk team ('admin'). Status is derived server-side:
// 'open' = last message is the customer's (awaiting us); 'replied' = last is ours.
export interface SupportThreadMessage {
  id: string;
  sender: string; // 'customer' | 'admin'
  body: string;
  created_at: string | null;
}

export interface SupportThread {
  thread_id: string;
  org_id: string | null;
  email: string | null;
  subject: string | null;
  status: string; // open | replied
  created_at: string | null;
  updated_at: string | null;
  messages: SupportThreadMessage[];
}

/** Admin (founder-only): every support thread across all orgs, newest activity first. */
export async function fetchAdminSupport(
  session: Session,
): Promise<{ threads: SupportThread[]; open_count: number }> {
  const res = await fetch(`${BACKEND_URL}/admin/support`, {
    headers: authHeaders(session),
    cache: "no-store",
  });
  if (res.status === 403) throw new AdminForbiddenError("Admin access only.");
  if (res.status === 401) throw new AuthError("Not authorized for /admin/support");
  if (!res.ok) throw new Error(`Backend /admin/support failed: ${res.status}`);
  const data = (await res.json()) as { threads: SupportThread[]; open_count: number };
  return { threads: data.threads ?? [], open_count: data.open_count ?? 0 };
}

// ── Outbound campaigns (per org) ───────────────────────────────────
export interface OutboundCampaignSummary {
  id: string;
  name: string;
  goal: string;
  status: string;
  created_at: string | null;
  total: number;
  completed: number;
  failed: number;
}

export interface OutboundTarget {
  id: string;
  name: string;
  phone: string;
  status: string;
  call_id: string | null;
  outcome: string | null;
  transcript: string;
  duration_sec: number | null;
  created_at: string | null;
}

export interface OutboundCampaign {
  id: string;
  name: string;
  goal: string;
  script: string;
  status: string;
  from_number: string;
  created_at: string | null;
  targets: OutboundTarget[];
}

export async function fetchCampaigns(session: Session): Promise<OutboundCampaignSummary[]> {
  const data = await backendGet<{ campaigns: OutboundCampaignSummary[] }>(
    "/outbound/campaigns",
    session,
  );
  return data.campaigns ?? [];
}

// ── Phone numbers (per org) ────────────────────────────────────────
export interface NumberRow {
  phone_e164: string;
  label: string | null;
  created_at: string | null;
}

export async function fetchNumbers(session: Session): Promise<NumberRow[]> {
  const data = await backendGet<{ numbers: NumberRow[] }>("/numbers", session);
  return data.numbers ?? [];
}
