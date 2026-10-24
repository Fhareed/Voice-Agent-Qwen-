import { NextResponse } from "next/server";

function clear(res: NextResponse) {
  for (const name of ["ld_token", "ld_org", "ld_org_name"]) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  return res;
}

export async function POST() {
  return clear(NextResponse.json({ ok: true }));
}

// GET clears the session cookies and sends the user to /login. Protected pages
// redirect here when the backend no longer accepts the token (e.g. it expired),
// so the stale cookie is removed and middleware won't bounce /login back to /app.
export async function GET(req: Request) {
  return clear(NextResponse.redirect(new URL("/login", req.url)));
}
