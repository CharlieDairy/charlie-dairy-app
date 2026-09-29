"use server";

import { prisma } from "@/lib/prisma";
import { getCategoryDef } from "@/lib/masterData";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requirePermission, runAction } from "@/lib/access";

export type FormState = { success: boolean; message: string } | undefined;

export async function updateLabel(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => updateLabelImpl(_prev, formData));
}

async function updateLabelImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission("admin", "EDIT");
  const id = formData.get("id") as string | null;
  const label = (formData.get("label") as string | null)?.trim();

  if (!id || !label) return { success: false, message: "Label can't be empty." };
  if (label.length > 100) return { success: false, message: "Label is too long (max 100 characters)." };

  const exists = await prisma.masterDataItem.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return { success: false, message: "That item no longer exists. Refresh the page." };
  await prisma.masterDataItem.update({ where: { id }, data: { label } });
  revalidatePath("/admin/master-data");
  return { success: true, message: "Saved." };
}

export async function toggleActive(formData: FormData): Promise<void> {
  await requirePermission("admin", "EDIT");
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";
  await prisma.masterDataItem.updateMany({ where: { id }, data: { active } });
  revalidatePath("/admin/master-data");
}

export async function addItem(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => addItemImpl(_prev, formData));
}

async function addItemImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission("admin", "CREATE");
  const category = formData.get("category") as string | null;
  const code = (formData.get("code") as string | null)?.trim();
  const label = (formData.get("label") as string | null)?.trim();

  if (!category || !code || !label) {
    return { success: false, message: "Code and label are required." };
  }
  if (code.length > 50 || label.length > 100) {
    return { success: false, message: "Code (max 50) or label (max 100) is too long." };
  }
  const def = getCategoryDef(category);
  if (!def) return { success: false, message: "Unknown category." };
  if (def.locked) return { success: false, message: `${def.label} is a fixed list — you can rename or hide entries, but not add new ones.` };

  const count = await prisma.masterDataItem.count({ where: { category } });

  try {
    await prisma.masterDataItem.create({
      data: { category, code, label, locked: false, sortOrder: count },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { success: false, message: `"${code}" already exists in ${def.label}.` };
    }
    throw e;
  }

  revalidatePath("/admin/master-data");
  return { success: true, message: `Added "${label}".` };
}

export async function deleteItem(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => deleteItemImpl(_prev, formData));
}

async function deleteItemImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission("admin", "DELETE");
  const id = formData.get("id") as string | null;
  if (!id) return { success: false, message: "Missing item id." };

  const item = await prisma.masterDataItem.findUnique({ where: { id } });
  if (!item) return { success: false, message: "Item not found." };

  const def = getCategoryDef(item.category);
  if (def?.locked) {
    return { success: false, message: `${def.label} is a fixed list — you can rename or hide entries, but not delete them.` };
  }

  await prisma.masterDataItem.delete({ where: { id } });
  revalidatePath("/admin/master-data");
  return { success: true, message: `Deleted "${item.label}".` };
}
