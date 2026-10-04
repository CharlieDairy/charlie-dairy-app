"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqEnum, reqId, reqText } from "@/lib/validate";

export type FormState = { success: boolean; message: string } | undefined;

const FIELD_TYPES = ["TEXT", "NUMBER", "DATE"] as const;

export async function addCustomFieldDef(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => addCustomFieldDefImpl(formData));
}

async function addCustomFieldDefImpl(formData: FormData): Promise<FormState> {
  await requirePermission("herd", "CREATE");
  const label = reqText(formData, "label", "Field name", { max: 60 });
  const fieldType = reqEnum(formData, "fieldType", "Field type", FIELD_TYPES);

  const existing = await prisma.cowCustomFieldDef.findFirst({ where: { label: { equals: label, mode: "insensitive" } } });
  if (existing) {
    return { success: false, message: `A custom field named "${label}" already exists.` };
  }

  const maxSort = await prisma.cowCustomFieldDef.aggregate({ _max: { sortOrder: true } });
  await prisma.cowCustomFieldDef.create({
    data: { label, fieldType, sortOrder: (maxSort._max.sortOrder ?? -1) + 1 },
  });

  revalidatePath("/admin/cows/custom-fields");
  revalidatePath("/admin/cows");
  return { success: true, message: `Custom field "${label}" added.` };
}

export async function toggleCustomFieldActive(formData: FormData): Promise<void> {
  await requirePermission("herd", "EDIT");
  const id = reqId(formData, "id", "Field");
  const active = formData.get("active") === "true";
  await prisma.cowCustomFieldDef.updateMany({ where: { id }, data: { active } });
  revalidatePath("/admin/cows/custom-fields");
  revalidatePath("/admin/cows");
}

export async function updateCowCustomFields(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => updateCowCustomFieldsImpl(formData));
}

async function updateCowCustomFieldsImpl(formData: FormData): Promise<FormState> {
  await requirePermission("herd", "EDIT");
  const cowId = reqId(formData, "cowId", "Cow");

  const cow = await prisma.cow.findUnique({ where: { id: cowId }, select: { id: true } });
  if (!cow) throw new ValidationError("Cow not found.");

  const defs = await prisma.cowCustomFieldDef.findMany({ where: { active: true } });

  // Validate every value against its declared type before writing any of them.
  const rows = defs.map((def) => {
    const raw = (formData.get(`field_${def.id}`) as string | null)?.trim() ?? "";
    if (raw.length > 300) throw new ValidationError(`"${def.label}" is too long (max 300 characters).`);
    if (raw !== "" && def.fieldType === "NUMBER" && !/^-?\d+(\.\d+)?$/.test(raw.replace(/,/g, ""))) {
      throw new ValidationError(`"${def.label}" must be a number.`);
    }
    if (raw !== "" && def.fieldType === "DATE" && (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(new Date(raw).getTime()))) {
      throw new ValidationError(`"${def.label}" must be a valid date.`);
    }
    return { def, raw };
  });

  await prisma.$transaction(
    rows.map(({ def, raw }) =>
      prisma.cowCustomFieldValue.upsert({
        where: { cowId_fieldDefId: { cowId, fieldDefId: def.id } },
        update: { value: raw },
        create: { cowId, fieldDefId: def.id, value: raw },
      })
    )
  );

  revalidatePath(`/admin/cows/${cowId}`);
  return { success: true, message: "Custom fields updated." };
}
