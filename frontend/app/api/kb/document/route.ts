import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/api";

// Upload a document (PDF / Word / text) into the caller's knowledge base.
// Forwards the multipart form straight through to the backend.
export async function POST(req: Request) {
  const c = cookies();
  const token = c.get("ld_token")?.value;
  const org = c.get("ld_org")?.value;
  if (!token || !org) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  try {
    const r = await fetch(`${BACKEND_URL}/documents`, {
      method: "POST",
      // No Content-Type header: fetch sets the multipart boundary from the FormData.
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Org-Id": org,
      },
      body: form,
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json({ error: data.error || "Couldn't upload that." }, { status: r.status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Can't reach the backend right now." }, { status: 502 });
  }
}
