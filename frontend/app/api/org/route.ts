import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/api";

const secure = process.env.NODE_ENV === "production";
const MAX_AGE = 60 * 60 * 8;

// Create an organization for the logged-in user and remember it as the active org.
export async function POST(req: Request) {
  const token = cookies().get("ld_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "A business name is required." }, { status: 400 });
  }

  let r: Response;
  try {
    r = await fetch(`${BACKEND_URL}/orgs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Can't reach the backend." }, { status: 502 });
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    return NextResponse.json({ error: data.error || "Could not create organization." }, { status: r.status });
  }

  const res = NextResponse.json({ ok: true, org_id: data.org_id, name: data.name });
  res.cookies.set("ld_org", data.org_id, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: MAX_AGE });
  res.cookies.set("ld_org_name", data.name ?? name, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: MAX_AGE });
  return res;
}
