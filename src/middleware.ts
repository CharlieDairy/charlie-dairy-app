import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { moduleForPath } from "@/lib/modules";
import { authConfig } from "@/auth.config";

// Deliberately a separate, edge-safe NextAuth instance (not the one from
// @/auth) -- importing @/auth here would pull the full Prisma client and
// bcrypt into this Edge Function's bundle and blow past Vercel's 1MB edge
// function size limit. This instance only ever reads/verifies the existing
// JWT cookie; it never runs the Credentials provider or touches the DB.
const { auth } = NextAuth(authConfig);

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
