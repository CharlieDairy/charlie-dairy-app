"use server";

import { prisma } from "@/lib/prisma";
import { getCategoryDef } from "@/lib/masterData";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

export type FormState = { success: boolean; message: string } | undefined;

export async function updateLabel(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = formData.get("id") as string | null;
  const label = (formData.get("label") as string | null)?.trim();

  if (!id || !label) return { success: false, message: "Label can't be empty." };

  await prisma.masterDataItem.update({ where: { id }, data: { label } });
  revalidatePath("/admin/master-data");
  return { success: true, message: "Saved." };
}

export async function toggleActive(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";
  await prisma.masterDataItem.update({ where: { id }, data: { active } });
  revalidatePath("/admin/master-data");
}

export async function addItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const category = formData.get("category") as string | null;
  const code = (formData.get("code") as string | null)?.trim();
  const label = (formData.get("label") as string | null)?.trim();

  if (!category || !code || !label) {
    return { success: false, message: "Code and label are required." };
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
