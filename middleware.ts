import { NextRequest, NextResponse } from "next/server";
export function middleware(req: NextRequest) {
  const has = req.cookies.has("sozamen_session");
  if (
    !has &&
    (req.nextUrl.pathname.startsWith("/dashboard") || req.nextUrl.pathname.startsWith("/admin"))
  ) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/dashboard/:path*", "/admin/:path*"] };
