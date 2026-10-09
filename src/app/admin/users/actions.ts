"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireAccess, runAction } from "@/lib/access";
import { AccessError } from "@/lib/errors";
import { reqText, reqEnum, reqId } from "@/lib/validate";
import { randomBytes } from "node:crypto";
import { issuePasswordToken, passwordLink, INVITE_HOURS, RESET_HOURS } from "@/lib/passwordTokens";

export type FormState = { success: boolean; message: string; link?: string } | undefined;

const ROLES = ["ADMIN", "EDITOR", "VIEWER", "PARTNER"] as const;

function isValidUsername(username: string): boolean {
  return /^[a-z0-9._-]{3,32}$/i.test(username);
}

// Only an Admin manages accounts: three fixed roles -- ADMIN (everything),\r\n// EDITOR (read/add/edit/delete outside the Admin area) and VIEWER (read only).\r\n
async function otherActiveAdminExists(excludeUserId: string): Promise<boolean> {
  const count = await prisma.user.count({ where: { role: "ADMIN", active: true, NOT: { id: excludeUserId } } });
  return count > 0;
}

export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => createUserImpl(formData));
}

// The app is invite-only: only an Admin creates an account, and the person
// sets their own password by opening a one-time link the Admin shares. No
// password is ever typed in by (or known to) the Admin.
async function createUserImpl(formData: FormData): Promise<FormState> {
  await requireAccess({ admin: true });

  const name = reqText(formData, "name", "Name", { max: 100 });
  const username = reqText(formData, "username", "Username", { max: 32 });
  const role = reqEnum(formData, "role", "Role", ROLES);

  if (!isValidUsername(username)) {
    return { success: false, message: "Username must be 3-32 characters: letters, numbers, dots, dashes or underscores." };
  }

  const existing = await prisma.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } } });
  if (existing) {
    return { success: false, message: `Username "${username}" is already in use.` };
  }

  // A random, never-disclosed password until they set their own via the link.
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
  const user = await prisma.user.create({
    data: { name, username, passwordHash, role },
  });

  const link = await passwordLink(await issuePasswordToken(user.id, "INVITE"));
  revalidatePath("/admin/users");
  return {
    success: true,
    message: `Invite created for "${username}". Send them this link — it works once and expires in ${INVITE_HOURS} hours:`,
    link,
  };
}

// New one-time link for someone who forgot their password (or whose invite
// expired). Admin only; replaces any earlier unused link for that person.
export async function createResetLink(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => createResetLinkImpl(formData));
}

async function createResetLinkImpl(formData: FormData): Promise<FormState> {
  await requireAccess({ admin: true });
  const userId = reqId(formData, "userId", "User");

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, active: true } });
  if (!target) return { success: false, message: "User not found." };
  if (!target.active) return { success: false, message: "That account is deactivated. Reactivate it first." };

  const link = await passwordLink(await issuePasswordToken(userId, "RESET"));
  await prisma.user.update({ where: { id: userId }, data: { resetRequestedAt: null } });
  revalidatePath("/admin/users");
  return { success: true, message: `Reset link for ${target.username} (works once, expires in ${RESET_HOURS} hours):`, link };
}

export async function setUserRole(formData: FormData): Promise<void> {
  const caller = await requireAccess({ admin: true });
  const userId = reqId(formData, "userId", "User");
  const role = reqEnum(formData, "role", "Role", ROLES);

  // Refuse changes to your own role to avoid self-lockout; the UI already
  // disables this control for the signed-in user.
  if (userId === caller.id) return;

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, active: true } });
  if (!target) return;
  if (target.role === "ADMIN" && role !== "ADMIN" && target.active && !(await otherActiveAdminExists(userId))) {
    throw new AccessError("You can't demote the last active Admin.");
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin/users");
}

export async function setUserActive(formData: FormData): Promise<void> {
  const caller = await requireAccess({ admin: true });
  const userId = reqId(formData, "userId", "User");
  const active = formData.get("active") === "true";

  if (userId === caller.id) return;

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, active: true } });
  if (!target) return;
  if (target.role === "ADMIN") {
    if (!active && target.active && !(await otherActiveAdminExists(userId))) {
      throw new AccessError("You can't deactivate the last active Admin.");
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { active } });
  revalidatePath("/admin/users");
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => resetPasswordImpl(formData));
}

async function resetPasswordImpl(formData: FormData): Promise<FormState> {
  await requireAccess({ admin: true });
  const userId = reqId(formData, "userId", "User");
  const newPassword = formData.get("newPassword");

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return { success: false, message: "Password must be at least 8 characters." };
  }
  if (newPassword.length > 128) return { success: false, message: "Password must be 128 characters or fewer." };

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, username: true } });
  if (!target) return { success: false, message: "User not found." };

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  revalidatePath("/admin/users");
  return { success: true, message: `Password reset for ${target.username}.` };
}

