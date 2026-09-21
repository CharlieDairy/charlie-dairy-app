import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const role = (req.auth?.user as { role?: string } | undefined)?.role;

  if (pathname === "/login") {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL(role === "ADMIN" ? "/admin" : "/entry", req.url));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/entry", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/", "/entry/:path*", "/admin/:path*", "/login"],
};
