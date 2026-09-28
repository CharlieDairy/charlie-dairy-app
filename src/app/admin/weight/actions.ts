"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

export async function addWeightStandard(_prev: FormState, formData: FormData): Promise<FormState> {
  const breed = (formData.get("breed") as string | null)?.trim() || null;
  const ageMonthsRaw = formData.get("ageMonths") as string | null;
  const minRaw = formData.get("minWeightKg") as string | null;
  const maxRaw = formData.get("maxWeightKg") as string | null;

  const ageMonths = ageMonthsRaw ? parseInt(ageMonthsRaw, 10) : NaN;
  const minWeightKg = minRaw ? parseFloat(minRaw) : NaN;
  const maxWeightKg = maxRaw ? parseFloat(maxRaw) : NaN;

  if (Number.isNaN(ageMonths) || Number.isNaN(minWeightKg) || Number.isNaN(maxWeightKg)) {
    return { success: false, message: "Age (months), minimum and maximum weight are required." };
  }
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
  const id = formData.get("id") as string;
  await prisma.weightStandard.delete({ where: { id } });
  revalidatePath("/admin/weight/standards");
  revalidatePath("/admin/reports/weight");
}

export async function addWeightEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const cowId = formData.get("cowId") as string | null;
  const dateRaw = formData.get("date") as string | null;
  const weightRaw = formData.get("weightKg") as string | null;

  const weightKg = weightRaw ? parseFloat(weightRaw) : NaN;
  if (!cowId || !dateRaw || Number.isNaN(weightKg) || weightKg <= 0) {
    return { success: false, message: "Animal, date and a positive weight are required." };
  }

  await prisma.weightRecord.create({
    data: { cowId, date: new Date(dateRaw), weightKg, enteredBy: session?.user?.name ?? null },
  });

  revalidatePath("/entry/weight");
  revalidatePath("/admin/reports/weight");
  revalidatePath(`/admin/cows/${cowId}`);
  return { success: true, message: "Weight recorded." };
}
