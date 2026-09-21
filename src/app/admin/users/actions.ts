"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

function isValidUsername(username: string): boolean {
  return /^[a-z0-9._-]{3,32}$/i.test(username);
}

export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = (formData.get("name") as string | null)?.trim();
  const username = (formData.get("username") as string | null)?.trim();
  const password = formData.get("password") as string | null;
  const role = formData.get("role") as string | null;

  if (!name || !username || !password || !role) {
    return { success: false, message: "Name, username, password and role are required." };
  }
  if (!isValidUsername(username)) {
    return { success: false, message: "Username must be 3-32 characters: letters, numbers, dots, dashes or underscores." };
  }
  if (password.length < 8) {
    return { success: false, message: "Password must be at least 8 characters." };
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return { success: false, message: `Username "${username}" is already in use.` };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name, username, passwordHash, role: role as "ADMIN" | "ENTRY" },
  });

  revalidatePath("/admin/users");
  return { success: true, message: `User "${username}" created.` };
}

export async function setUserRole(formData: FormData): Promise<void> {
  const session = await auth();
  const userId = formData.get("userId") as string;
  const role = formData.get("role") as "ADMIN" | "ENTRY";

  const currentUserId = (session?.user as { id?: string } | undefined)?.id;
  if (userId === currentUserId) {
    // Refuse silently-in-place changes to your own role to avoid self-lockout;
    // the UI already disables this control for the signed-in user.
    return;
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin/users");
}

export async function setUserActive(formData: FormData): Promise<void> {
  const session = await auth();
  const userId = formData.get("userId") as string;
  const active = formData.get("active") === "true";

  const currentUserId = (session?.user as { id?: string } | undefined)?.id;
  if (userId === currentUserId) {
    return;
  }

  await prisma.user.update({ where: { id: userId }, data: { active } });
  revalidatePath("/admin/users");
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = formData.get("userId") as string | null;
  const newPassword = formData.get("newPassword") as string | null;

  if (!userId || !newPassword) {
    return { success: false, message: "Missing user or password." };
  }
  if (newPassword.length < 8) {
    return { success: false, message: "Password must be at least 8 characters." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const user = await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  revalidatePath("/admin/users");
  return { success: true, message: `Password reset for ${user.username}.` };
}
