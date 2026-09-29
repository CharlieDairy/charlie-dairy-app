"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { isValidModule } from "@/lib/modules";
import { requireAccess, runAction } from "@/lib/access";
import { AccessError } from "@/lib/errors";
import { reqText, reqEnum, reqId } from "@/lib/validate";

export type FormState = { success: boolean; message: string } | undefined;

const ROLES = ["ADMIN", "ENTRY"] as const;

function isValidUsername(username: string): boolean {
  return /^[a-z0-9._-]{3,32}$/i.test(username);
}


// Anyone holding the People module may manage ENTRY accounts, but only an
// Admin may create, modify, disable or reset an ADMIN account, change roles
// or hand out modules they don't hold themselves -- otherwise "People"
// would be a back door to full admin.

async function otherActiveAdminExists(excludeUserId: string): Promise<boolean> {
  const count = await prisma.user.count({ where: { role: "ADMIN", active: true, NOT: { id: excludeUserId } } });
  return count > 0;
}

export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => createUserImpl(formData));
}

async function createUserImpl(formData: FormData): Promise<FormState> {
  const caller = await requireAccess({ module: "PEOPLE" });

  const name = reqText(formData, "name", "Name", { max: 100 });
  const username = reqText(formData, "username", "Username", { max: 32 });
  const role = reqEnum(formData, "role", "Role", ROLES);
  const password = formData.get("password");

  if (role === "ADMIN" && caller.role !== "ADMIN") {
    throw new AccessError("Only an Admin can create another Admin account.");
  }
  if (!isValidUsername(username)) {
    return { success: false, message: "Username must be 3-32 characters: letters, numbers, dots, dashes or underscores." };
  }
  if (typeof password !== "string" || password.length < 8) {
    return { success: false, message: "Password must be at least 8 characters." };
  }
  if (password.length > 128) return { success: false, message: "Password must be 128 characters or fewer." };

  const existing = await prisma.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } } });
  if (existing) {
    return { success: false, message: `Username "${username}" is already in use.` };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { name, username, passwordHash, role } });

  revalidatePath("/admin/users");
  return { success: true, message: `User "${username}" created.` };
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
  const caller = await requireAccess({ module: "PEOPLE" });
  const userId = reqId(formData, "userId", "User");
  const active = formData.get("active") === "true";

  if (userId === caller.id) return;

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, active: true } });
  if (!target) return;
  if (target.role === "ADMIN") {
    if (caller.role !== "ADMIN") throw new AccessError("Only an Admin can change an Admin account.");
    if (!active && target.active && !(await otherActiveAdminExists(userId))) {
      throw new AccessError("You can't deactivate the last active Admin.");
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { active } });
  revalidatePath("/admin/users");
}

export async function toggleModule(formData: FormData): Promise<void> {
  const caller = await requireAccess({ module: "PEOPLE" });
  const userId = reqId(formData, "userId", "User");
  const moduleRaw = formData.get("module");
  const grant = formData.get("grant") === "true";

  if (typeof moduleRaw !== "string" || !isValidModule(moduleRaw)) return;
  // You can only hand out access you hold yourself (Admins hold everything).
  if (caller.role !== "ADMIN" && !caller.modules.includes(moduleRaw)) {
    throw new AccessError("You can only grant modules you have access to yourself.");
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target || target.role === "ADMIN") return; // Admins implicitly hold every module.

  if (grant) {
    await prisma.moduleAccess.upsert({
      where: { userId_module: { userId, module: moduleRaw } },
      update: {},
      create: { userId, module: moduleRaw },
    });
  } else {
    await prisma.moduleAccess.deleteMany({ where: { userId, module: moduleRaw } });
  }

  revalidatePath("/admin/users");
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => resetPasswordImpl(formData));
}

async function resetPasswordImpl(formData: FormData): Promise<FormState> {
  const caller = await requireAccess({ module: "PEOPLE" });
  const userId = reqId(formData, "userId", "User");
  const newPassword = formData.get("newPassword");

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return { success: false, message: "Password must be at least 8 characters." };
  }
  if (newPassword.length > 128) return { success: false, message: "Password must be 128 characters or fewer." };

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, username: true } });
  if (!target) return { success: false, message: "User not found." };
  if (target.role === "ADMIN" && caller.role !== "ADMIN") {
    throw new AccessError("Only an Admin can reset an Admin's password.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  revalidatePath("/admin/users");
  return { success: true, message: `Password reset for ${target.username}.` };
}
