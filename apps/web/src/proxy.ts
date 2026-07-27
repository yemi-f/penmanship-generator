import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

const PROTECTED_PREFIXES = ["/cards", "/samples", "/create", "/card"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (isProtected && !req.auth) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
});

export const config = {
  matcher: ["/cards/:path*", "/samples/:path*", "/create/:path*", "/card/:path*"],
};
