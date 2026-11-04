import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/api";

// Unmap a number from this org (release=true also releases it from Retell).
function session() {
  const c = cookies();
  return { token: c.get("ld_token")?.value, org: c.get("ld_org")?.value };
}

export async function DELETE(req: Request, { params }: { params: { e164: string } }) {
  const { token, org } = session();
  if (!token || !org) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const release = new URL(req.url).searchParams.get("release") === "true";
  try {
    const r = await fetch(
      `${BACKEND_URL}/numbers/${encodeURIComponent(params.e164)}?release=${release}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "X-Org-Id": org },
        cache: "no-store",
      },
    );
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 || r.status === 403) {
      return NextResponse.json(
        { error: data.detail || data.error || "Your session expired — please sign in again.", authExpired: true },
        { status: r.status },
      );
    }
    if (!r.ok) return NextResponse.json({ error: data.detail || data.error || "Couldn't remove it." }, { status: r.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Can't reach the backend right now." }, { status: 502 });
  }
}
