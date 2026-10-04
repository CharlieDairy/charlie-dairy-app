import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

const LOCKOUT_WINDOW_MS = 15 * 60_000;
const MAX_FAILED_PER_ACCOUNT = 5;
const MAX_FAILED_PER_MINUTE = 60;

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const username = credentials?.username as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!username || !password) return null;
        if (username.length > 64 || password.length > 128) return null;

        const user = await prisma.user.findUnique({ where: { username } });

        // Brute-force protection: after MAX_FAILED wrong attempts in the
        // window, further attempts are refused outright (and, deliberately,
        // not logged -- otherwise a guessing script could also flood the
        // audit table). A separate global ceiling covers username spraying.
        const since = new Date(Date.now() - LOCKOUT_WINDOW_MS);
        const [recentForAccount, recentGlobal] = await Promise.all([
          prisma.auditLog.count({
            where: {
              action: "login_failed",
              createdAt: { gte: since },
              ...(user ? { userId: user.id } : { userName: username, userId: null }),
            },
          }),
          prisma.auditLog.count({ where: { action: "login_failed", createdAt: { gte: new Date(Date.now() - 60_000) } } }),
        ]);
        if (recentForAccount >= MAX_FAILED_PER_ACCOUNT || recentGlobal >= MAX_FAILED_PER_MINUTE) {
          console.warn("[auth] login refused: too many recent failed attempts");
          return null;
        }

        const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
        const success = !!user && valid && user.active;

        await prisma.auditLog.create({
          data: {
            userId: user?.id ?? null,
            userName: user?.name ?? username,
            action: success ? "login" : "login_failed",
            entity: "User",
            entityId: user?.id ?? null,
            newValue: success
              ? null
              : JSON.stringify({ reason: !user ? "unknown username" : !valid ? "wrong password" : "account inactive" }),
          },
        }).catch((e) => console.error("[audit] failed to record login attempt", e));

        if (!success) return null;
        return { id: user!.id, name: user!.name, role: user!.role };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        // The role in the JWT only drives middleware's first-pass route gate;
        // the layouts and every server action re-read the live role from the
        // database (getLiveUser() in src/lib/access.ts).
        token.role = (user as { role: string }).role;
        token.id = user.id;
      }
      return token;
    },
  },
});
