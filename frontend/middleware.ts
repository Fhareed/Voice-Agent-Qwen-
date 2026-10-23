import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public: "/" (marketing), "/login", "/signup". Protected: everything under "/app".
export function middleware(req: NextRequest) {
  const token = req.cookies.get("ld_token")?.value;
  const { pathname } = req.nextUrl;
  const isApp = pathname === "/app" || pathname.startsWith("/app/");
  const isAuth = pathname === "/login" || pathname === "/signup";

  if (isApp && !token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (isAuth && token) {
    const url = req.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
