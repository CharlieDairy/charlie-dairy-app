"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

export async function addCustomFieldDef(_prev: FormState, formData: FormData): Promise<FormState> {
  const label = (formData.get("label") as string | null)?.trim();
  const fieldType = formData.get("fieldType") as string | null;

  if (!label || !fieldType) {
    return { success: false, message: "Field name and type are required." };
  }
  if (!["TEXT", "NUMBER", "DATE"].includes(fieldType)) {
    return { success: false, message: "Invalid field type." };
  }

  const existing = await prisma.cowCustomFieldDef.findFirst({ where: { label: { equals: label, mode: "insensitive" } } });
  if (existing) {
    return { success: false, message: `A custom field named "${label}" already exists.` };
  }

  const maxSort = await prisma.cowCustomFieldDef.aggregate({ _max: { sortOrder: true } });
  await prisma.cowCustomFieldDef.create({
    data: { label, fieldType: fieldType as "TEXT" | "NUMBER" | "DATE", sortOrder: (maxSort._max.sortOrder ?? -1) + 1 },
  });

  revalidatePath("/admin/cows/custom-fields");
  revalidatePath("/admin/cows");
  return { success: true, message: `Custom field "${label}" added.` };
}

export async function toggleCustomFieldActive(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";
  await prisma.cowCustomFieldDef.update({ where: { id }, data: { active } });
  revalidatePath("/admin/cows/custom-fields");
  revalidatePath("/admin/cows");
}

export async function updateCowCustomFields(_prev: FormState, formData: FormData): Promise<FormState> {
  const cowId = formData.get("cowId") as string | null;
  if (!cowId) return { success: false, message: "Missing cow id." };

  const defs = await prisma.cowCustomFieldDef.findMany({ where: { active: true } });

  await prisma.$transaction(
    defs.map((def) => {
      const raw = (formData.get(`field_${def.id}`) as string | null)?.trim() ?? "";
      return prisma.cowCustomFieldValue.upsert({
        where: { cowId_fieldDefId: { cowId, fieldDefId: def.id } },
        update: { value: raw },
        create: { cowId, fieldDefId: def.id, value: raw },
      });
    })
  );

  revalidatePath(`/admin/cows/${cowId}`);
  return { success: true, message: "Custom fields updated." };
}
