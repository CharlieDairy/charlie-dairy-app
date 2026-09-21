import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { moduleForPath } from "@/lib/modules";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const role = (req.auth?.user as { role?: string } | undefined)?.role;
  const modules = (req.auth?.user as { modules?: string[] } | undefined)?.modules ?? [];

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
    const required = moduleForPath(pathname);
    // The bare dashboard (no specific module required) is open to anyone
    // with at least one module grant; a specific section needs that exact
    // module granted.
    const allowed = required ? modules.includes(required) : modules.length > 0;
    if (!allowed) {
      return NextResponse.redirect(new URL("/entry", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/", "/entry/:path*", "/admin/:path*", "/login"],
};
