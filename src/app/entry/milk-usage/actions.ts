"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqEnum, reqNum, optText, MILK_USE_TYPES } from "@/lib/validate";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

export async function submitMilkUsage(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => submitMilkUsageImpl(formData));
}

async function submitMilkUsageImpl(formData: FormData): Promise<FormState> {
  const user = await requirePermission("milk", "CREATE");

  const date = reqDate(formData, "date", "Date");
  const type = reqEnum(formData, "type", "Use type", MILK_USE_TYPES);
  const litres = reqNum(formData, "litres", "Quantity", { positive: true, max: 100_000 });
  const notes = optText(formData, "notes", "Notes", { max: 500 });

  const duplicate = await prisma.milkUsageRecord.findFirst({
    where: { date, type, litres, createdAt: { gte: new Date(Date.now() - 120_000) } },
    select: { id: true },
  });
  if (duplicate) {
    throw new ValidationError("This looks identical to an entry saved moments ago, so it wasn't saved twice.");
  }

  await prisma.milkUsageRecord.create({ data: { date, type, litres, notes, enteredBy: user.name } });

  revalidatePath("/admin/reports/reconciliation");
  revalidatePath("/entry/milk-sale");
  return { success: true, message: "Milk use recorded." };
}
