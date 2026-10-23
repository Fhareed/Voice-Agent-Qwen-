import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  for (const name of ["ld_token", "ld_org", "ld_org_name"]) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  return res;
}
