"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, requireAccess, assertNotBackdated, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqId, reqNum, optText } from "@/lib/validate";

export type FormState = { success: boolean; message: string } | undefined;

export async function addWeightStandard(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => addWeightStandardImpl(formData));
}

async function addWeightStandardImpl(formData: FormData): Promise<FormState> {
  await requirePermission("weight", "CREATE");
  const breed = optText(formData, "breed", "Breed", { max: 100 });
  const ageMonths = reqNum(formData, "ageMonths", "Age (months)", { min: 0, max: 400, decimals: 0 });
  const minWeightKg = reqNum(formData, "minWeightKg", "Minimum weight", { positive: true, max: 2000 });
  const maxWeightKg = reqNum(formData, "maxWeightKg", "Maximum weight", { positive: true, max: 2000 });

  if (minWeightKg >= maxWeightKg) {
    return { success: false, message: "Minimum weight must be less than maximum weight." };
  }

  const existing = await prisma.weightStandard.findFirst({ where: { breed, ageMonths } });
  if (existing) {
    return { success: false, message: `A standard for ${breed ?? "any breed"} at ${ageMonths} months already exists.` };
  }

  await prisma.weightStandard.create({ data: { breed, ageMonths, minWeightKg, maxWeightKg } });

  revalidatePath("/admin/weight/standards");
  revalidatePath("/admin/reports/weight");
  return { success: true, message: "Weight standard added." };
}

export async function deleteWeightStandard(formData: FormData): Promise<void> {
  await requireAccess({ admin: true });
  const id = reqId(formData, "id", "Standard");
  await prisma.weightStandard.deleteMany({ where: { id } });
  revalidatePath("/admin/weight/standards");
  revalidatePath("/admin/reports/weight");
}

export async function addWeightEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => addWeightEntryImpl(formData));
}

async function addWeightEntryImpl(formData: FormData): Promise<FormState> {
  const user = await requirePermission("weight", "CREATE");
  const cowId = reqId(formData, "cowId", "Animal");
  const date = reqDate(formData, "date", "Date");
  assertNotBackdated(date, user, "Date");
  const weightKg = reqNum(formData, "weightKg", "Weight", { positive: true, max: 2000, decimals: 1 });

  const cow = await prisma.cow.findUnique({ where: { id: cowId }, select: { id: true } });
  if (!cow) throw new ValidationError("Animal not found.");

  const duplicate = await prisma.weightRecord.findFirst({
    where: { cowId, date, weightKg, createdAt: { gte: new Date(Date.now() - 120_000) } },
    select: { id: true },
  });
  if (duplicate) throw new ValidationError("This weight was just recorded, so it wasn't saved twice.");

  await prisma.weightRecord.create({ data: { cowId, date, weightKg, enteredBy: user.name } });

  revalidatePath("/entry/weight");
  revalidatePath("/admin/reports/weight");
  revalidatePath(`/admin/cows/${cowId}`);
  return { success: true, message: "Weight recorded." };
}
