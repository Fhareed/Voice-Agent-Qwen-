import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/api";

// Clear (wipe) the caller's entire knowledge base.
export async function DELETE() {
  const c = cookies();
  const token = c.get("ld_token")?.value;
  const org = c.get("ld_org")?.value;
  if (!token || !org) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  try {
    const r = await fetch(`${BACKEND_URL}/kb`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Org-Id": org,
      },
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json({ error: data.error || "Couldn't clear it." }, { status: r.status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Can't reach the backend right now." }, { status: 502 });
  }
}
