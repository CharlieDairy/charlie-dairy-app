"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { findValidToken } from "@/lib/passwordTokens";

export async function setPasswordWithToken(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const rawToken = String(formData.get("token") ?? "");
  const password = formData.get("password");
  const confirm = formData.get("confirm");

  if (typeof password !== "string" || password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 128) return "Password must be 128 characters or fewer.";
  if (password !== confirm) return "The two passwords don't match.";

  const token = await findValidToken(rawToken);
  if (!token) return "This link is no longer valid. Ask your Admin for a new one.";

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: token.userId }, data: { passwordHash, resetRequestedAt: null } }),
    prisma.passwordToken.deleteMany({ where: { userId: token.userId } }),
  ]);

  redirect("/login?set=1");
}
