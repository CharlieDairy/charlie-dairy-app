"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccess, requirePermission, runAction } from "@/lib/access";
import { AccessError, ValidationError } from "@/lib/errors";
import { reqText, reqEnum, reqId, optId, optText } from "@/lib/validate";
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from "@/lib/permissions";

export type FormState = { success: boolean; message: string } | undefined;

const ROLES = ["ADMIN", "ENTRY"] as const;

function isValidUsername(username: string): boolean {
  return /^[a-z0-9._-]{3,32}$/i.test(username);
}

// Anyone holding admin:CREATE/EDIT may manage ENTRY accounts and assign
// existing AccessRoles, but only an Admin may create, modify, disable or
// reset an ADMIN account, or change a user's ADMIN/ENTRY role -- otherwise
// the admin module would be a back door to full admin.

async function otherActiveAdminExists(excludeUserId: string): Promise<boolean> {
  const count = await prisma.user.count({ where: { role: "ADMIN", active: true, NOT: { id: excludeUserId } } });
  return count > 0;
}

export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => createUserImpl(formData));
}

async function createUserImpl(formData: FormData): Promise<FormState> {
  const caller = await requirePermission("admin", "CREATE");

  const name = reqText(formData, "name", "Name", { max: 100 });
  const username = reqText(formData, "username", "Username", { max: 32 });
  const role = reqEnum(formData, "role", "Role", ROLES);
  const password = formData.get("password");
  const accessRoleId = optId(formData, "accessRoleId", "Role");

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

  if (accessRoleId) {
    const role_ = await prisma.accessRole.findUnique({ where: { id: accessRoleId }, select: { id: true } });
    if (!role_) return { success: false, message: "Role not found." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name, username, passwordHash, role, accessRoleId: role === "ADMIN" ? null : accessRoleId },
  });

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

  await prisma.user.update({ where: { id: userId }, data: { role, accessRoleId: role === "ADMIN" ? null : undefined } });
  revalidatePath("/admin/users");
}

export async function setUserActive(formData: FormData): Promise<void> {
  const caller = await requirePermission("admin", "EDIT");
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

// Assigns an existing AccessRole (or clears it) for an ENTRY-role user. The
// role's own permissions were already vetted when it was created (gated by
// admin:CREATE) -- assigning a pre-existing role to someone is an admin:EDIT
// action, not a fresh grant of whatever the caller happens to hold.
export async function setUserAccessRole(formData: FormData): Promise<void> {
  await requirePermission("admin", "EDIT");
  const userId = reqId(formData, "userId", "User");
  const accessRoleId = optId(formData, "accessRoleId", "Role");

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target || target.role === "ADMIN") return; // Admins implicitly hold every permission.

  if (accessRoleId) {
    const role = await prisma.accessRole.findUnique({ where: { id: accessRoleId }, select: { id: true } });
    if (!role) return;
  }

  await prisma.user.update({ where: { id: userId }, data: { accessRoleId } });
  revalidatePath("/admin/users");
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => resetPasswordImpl(formData));
}

async function resetPasswordImpl(formData: FormData): Promise<FormState> {
  const caller = await requirePermission("admin", "EDIT");
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

// ---------------------------------------------------------------------------
// AccessRole CRUD -- the granular permission matrix.
// ---------------------------------------------------------------------------

export async function createAccessRole(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => createAccessRoleImpl(formData));
}

async function createAccessRoleImpl(formData: FormData): Promise<FormState> {
  await requirePermission("admin", "CREATE");
  const name = reqText(formData, "name", "Role name", { max: 60 });
  const description = optText(formData, "description", "Description", { max: 300 });

  const existing = await prisma.accessRole.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (existing) return { success: false, message: `A role named "${name}" already exists.` };

  const grants = readGrantsFromForm(formData);
  await prisma.$transaction(async (tx) => {
    const created = await tx.accessRole.create({ data: { name, description } });
    if (grants.length > 0) {
      await tx.accessRolePermission.createMany({
        data: grants.map((g) => ({ accessRoleId: created.id, module: g.module, action: g.action })),
      });
    }
    return created;
  });

  revalidatePath("/admin/users/roles");
  revalidatePath("/admin/users");
  redirect("/admin/users/roles");
}

export async function updateAccessRole(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => updateAccessRoleImpl(formData));
}

async function updateAccessRoleImpl(formData: FormData): Promise<FormState> {
  await requirePermission("admin", "EDIT");
  const id = reqId(formData, "id", "Role");
  const name = reqText(formData, "name", "Role name", { max: 60 });
  const description = optText(formData, "description", "Description", { max: 300 });

  const existing = await prisma.accessRole.findUnique({ where: { id } });
  if (!existing) return { success: false, message: "Role not found." };

  const clash = await prisma.accessRole.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, NOT: { id } },
    select: { id: true },
  });
  if (clash) return { success: false, message: `Another role is already named "${name}".` };

  const grants = readGrantsFromForm(formData);
  await prisma.$transaction(async (tx) => {
    await tx.accessRole.update({ where: { id }, data: { name, description } });
    await tx.accessRolePermission.deleteMany({ where: { accessRoleId: id } });
    if (grants.length > 0) {
      await tx.accessRolePermission.createMany({
        data: grants.map((g) => ({ accessRoleId: id, module: g.module, action: g.action })),
      });
    }
  });

  revalidatePath("/admin/users/roles");
  revalidatePath(`/admin/users/roles/${id}`);
  revalidatePath("/admin/users");
  return { success: true, message: `Role "${name}" updated.` };
}

function readGrantsFromForm(formData: FormData): { module: string; action: "VIEW" | "CREATE" | "EDIT" | "DELETE" | "EXPORT" }[] {
  const grants: { module: string; action: "VIEW" | "CREATE" | "EDIT" | "DELETE" | "EXPORT" }[] = [];
  for (const m of PERMISSION_MODULES) {
    for (const a of PERMISSION_ACTIONS) {
      if (formData.get(`perm_${m.key}_${a}`) === "on") grants.push({ module: m.key, action: a });
    }
  }
  return grants;
}

export async function deleteAccessRole(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => deleteAccessRoleImpl(formData));
}

async function deleteAccessRoleImpl(formData: FormData): Promise<FormState> {
  await requireAccess({ admin: true });
  const id = reqId(formData, "id", "Role");

  const role = await prisma.accessRole.findUnique({ where: { id } });
  if (!role) return { success: false, message: "Role not found." };

  const assignedCount = await prisma.user.count({ where: { accessRoleId: id } });
  if (assignedCount > 0) {
    throw new ValidationError(
      `"${role.name}" is assigned to ${assignedCount} user${assignedCount === 1 ? "" : "s"} and can't be deleted. Reassign them first.`
    );
  }

  await prisma.accessRole.delete({ where: { id } });
  revalidatePath("/admin/users/roles");
  revalidatePath("/admin/users");
  return { success: true, message: `Role "${role.name}" deleted.` };
}
