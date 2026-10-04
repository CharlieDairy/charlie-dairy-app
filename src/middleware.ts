import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { roleCanOpenPath, homeFor } from "@/lib/modules";
import { authConfig } from "@/auth.config";
import { PERIOD_COOKIE, PERIOD_FROM_COOKIE, PERIOD_TO_COOKIE, isPeriodKey } from "@/lib/periodOptions";

const PERIOD_COOKIE_OPTS = { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" as const };

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

  if (pathname === "/login") {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL(homeFor(role), req.url));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // First-pass, role-based gate (edge middleware can't touch Prisma, so this
  // only sees the role in the JWT from sign-in). Admin-only pages and, for
  // View Only users, every data-entry page are bounced to the user's home.
  if ((pathname.startsWith("/admin") || pathname.startsWith("/entry")) && !roleCanOpenPath(role, pathname)) {
    return NextResponse.redirect(new URL(homeFor(role), req.url));
  }

  // Forward the path as a REQUEST header (not a response header -- those never
  // reach the Server Component render) so admin/layout.tsx and
  // entry/layout.tsx, which re-read the user's CURRENT role from the database
  // on every request, can re-check this specific route against it rather than
  // the possibly stale role in the token.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  const res = NextResponse.next({ request: { headers: requestHeaders } });

  // The single standard period control (src/lib/periodOptions.ts, src/
  // components/PeriodBar.tsx) is a plain Link/form -- no client JS -- so the
  // "last period picked carries over between pages" behavior (src/lib/
  // period.ts resolvePeriod) is implemented here instead of per-component:
  // whenever a request to a gated page carries a `period` query param, mirror
  // it into a cookie so the next page without its own ?period= falls back to
  // it. Only touched when `period` is actually present, so a plain nav never
  // clears a previously chosen period.
  const periodParam = req.nextUrl.searchParams.get("period");
  if (isPeriodKey(periodParam)) {
    res.cookies.set(PERIOD_COOKIE, periodParam, PERIOD_COOKIE_OPTS);
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");
    if (periodParam === "custom" && from && to) {
      res.cookies.set(PERIOD_FROM_COOKIE, from, PERIOD_COOKIE_OPTS);
      res.cookies.set(PERIOD_TO_COOKIE, to, PERIOD_COOKIE_OPTS);
    } else {
      res.cookies.delete(PERIOD_FROM_COOKIE);
      res.cookies.delete(PERIOD_TO_COOKIE);
    }
  }

  return res;
});

export const config = {
  matcher: ["/", "/entry/:path*", "/admin/:path*", "/login"],
};
