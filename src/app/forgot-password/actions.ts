"use server";

import { prisma } from "@/lib/prisma";

// Same answer whether or not the username exists, so this can't be used to
// find out who has an account. The only effect is a "reset requested" flag
// on a real, active account for an Admin to act on (Users & Access).
export async function requestPasswordReset(_prev: string | undefined, formData: FormData): Promise<string> {
  const username = String(formData.get("username") ?? "").trim().slice(0, 64);
  if (username) {
    await prisma.user.updateMany({
      where: { username: { equals: username, mode: "insensitive" }, active: true },
      data: { resetRequestedAt: new Date() },
    });
  }
  return "If that username exists, your Admin has been notified. Ask them for a password reset link — it can take them a moment to see your request.";
}
