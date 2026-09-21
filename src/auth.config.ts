import type { NextAuthConfig } from "next-auth";

// Edge-safe base config: no providers, no Prisma, no bcrypt. Middleware runs
// on Vercel's Edge runtime with a strict bundle-size limit, so anything it
// imports (via auth.ts) must not pull in the full Prisma client -- that's
// what auth.ts (Node runtime, used by the /api/auth route handler and server
// actions) is for. See auth.ts for the real providers/DB-backed callbacks.
export const authConfig = {
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string; id?: string; modules?: string[] }).role = token.role as string;
        (session.user as { role?: string; id?: string; modules?: string[] }).id = token.id as string;
        (session.user as { role?: string; id?: string; modules?: string[] }).modules = (token.modules as string[]) ?? [];
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
