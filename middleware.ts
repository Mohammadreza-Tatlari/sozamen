import { NextRequest, NextResponse } from "next/server";
import {
  hasValidPreviewAccess,
  isPreviewAccessEnabled,
  PREVIEW_ACCESS_COOKIE,
} from "@/lib/preview-access";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (
    isPreviewAccessEnabled() &&
    pathname !== "/preview-access" &&
    !(await hasValidPreviewAccess(req.cookies.get(PREVIEW_ACCESS_COOKIE)?.value))
  ) {
    const url = new URL("/preview-access", req.url);
    url.searchParams.set("next", `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  const has = req.cookies.has("sozamen_session");
  if (
    !has &&
    (pathname.startsWith("/dashboard") ||
      pathname.startsWith("/admin") ||
      pathname === "/cart" ||
      pathname === "/checkout")
  ) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|favicon.ico).*)"],
};
