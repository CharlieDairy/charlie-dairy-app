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

  // /entry itself (the bare data-entry menu) stays open to any logged-in
  // user -- it's just a menu, and its own tiles are filtered per module
  // already (see src/app/entry/page.tsx). Individual /entry/<form> paths
  // are gated the same way /admin/* sections are.
  if ((pathname.startsWith("/admin") || pathname.startsWith("/entry/")) && role !== "ADMIN") {
    const required = moduleForPath(pathname);
    // The bare dashboard (no specific module required) is open to every
    // logged-in user by default; a specific section still needs that exact
    // module granted.
    const allowed = required ? modules.includes(required) : true;
    if (!allowed) {
      return NextResponse.redirect(new URL("/entry", req.url));
    }
  }

  // This first-pass gate above only ever sees the JWT's modules snapshot
  // from sign-in (edge middleware can't touch Prisma -- see the comment on
  // the `auth` instance above), so a permission revoked mid-session would
  // otherwise stay readable until the token expires. Forward the path as a
  // REQUEST header (not a response header -- those never reach the Server
  // Component render) so admin/layout.tsx and entry/layout.tsx, which
  // already do a live DB permission read for the sidebar on every request,
  // can re-check this specific route against CURRENT grants, not the stale
  // token.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: ["/", "/entry/:path*", "/admin/:path*", "/login"],
};
