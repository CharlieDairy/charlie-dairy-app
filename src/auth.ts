import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

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

        const user = await prisma.user.findUnique({ where: { username } });
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
        token.role = (user as { role: string }).role;
        token.id = user.id;
        // Only ENTRY-role users need this — ADMIN implicitly has every
        // module (see src/lib/modules.ts). Fetched once at sign-in and
        // carried in the JWT since sessions are stateless; a grant change
        // takes effect on the user's next login, same as the existing
        // `active` flag caveat documented on /admin/users.
        if ((user as { role: string }).role !== "ADMIN") {
          const grants = await prisma.moduleAccess.findMany({ where: { userId: user.id }, select: { module: true } });
          token.modules = grants.map((g) => g.module);
        } else {
          token.modules = [];
        }
      }
      return token;
    },
  },
});
