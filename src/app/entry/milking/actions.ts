"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqEnum, reqId, reqNum, optNum, SHIFTS } from "@/lib/validate";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

function refresh() {
  revalidatePath("/entry/milking");
  revalidatePath("/admin/reports/herd");
  revalidatePath("/admin/reports/reconciliation");
  revalidatePath("/admin");
}

export async function submitMilking(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => submitMilkingImpl(formData));
}

async function submitMilkingImpl(formData: FormData): Promise<FormState> {
  const user = await requirePermission("milk", "CREATE");

  const cowId = reqId(formData, "cowId", "Cow");
  const shift = reqEnum(formData, "shift", "Shift", SHIFTS);
  const date = reqDate(formData, "date", "Date");
  // Zero is a valid recorded milking (a cow that gave nothing); 200 L is well past any real single milking.
  const litres = reqNum(formData, "litres", "Litres", { min: 0, max: 200 });
  const fatPct = optNum(formData, "fatPct", "Fat %", { max: 20 });
  const snfPct = optNum(formData, "snfPct", "SNF %", { max: 20 });

  const cow = await prisma.cow.findUnique({ where: { id: cowId }, select: { tag: true, status: true } });
  if (!cow) throw new ValidationError("That cow was not found.");
  if (cow.status === "SOLD" || cow.status === "DEAD") {
    throw new ValidationError(`Cow ${cow.tag} is marked ${cow.status} and can't be milked.`);
  }

  // One record per cow per shift per day -- this is what stops a double tap
  // (or two people entering the same milking) from silently doubling production.
  const existing = await prisma.milkingRecord.findFirst({
    where: { cowId, shift, date },
    select: { litres: true },
  });
  if (existing) {
    throw new ValidationError(
      `Cow ${cow.tag} already has a ${shift.toLowerCase()} milking recorded for that date (${existing.litres} L). It was not saved again.`
    );
  }

  await prisma.milkingRecord.create({
    data: { cowId, shift, litres, fatPct, snfPct, date, enteredBy: user.name },
  });

  refresh();
  return { success: true, message: "Milking entry saved." };
}

// Channab's "Herd / Group Milk" fast path: one total for the whole herd/shift
// instead of per-cow detail. cowId is nullable on MilkingRecord specifically
// for this -- reports already treat a null cowId as an unattributed bulk
// total (see milkSession() in src/lib/reports/dashboardMetrics.ts), so no
// separate model or reconciliation-report change was needed.
export async function submitGroupMilking(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => submitGroupMilkingImpl(formData));
}

async function submitGroupMilkingImpl(formData: FormData): Promise<FormState> {
  const user = await requirePermission("milk", "CREATE");

  const shift = reqEnum(formData, "shift", "Shift", SHIFTS);
  const date = reqDate(formData, "date", "Date");
  const litres = reqNum(formData, "litres", "Total litres", { min: 0, max: 100_000 });

  const existing = await prisma.milkingRecord.findFirst({
    where: { cowId: null, shift, date },
    select: { litres: true },
  });
  if (existing) {
    throw new ValidationError(
      `A herd total for the ${shift.toLowerCase()} shift on that date already exists (${existing.litres} L). It was not saved again.`
    );
  }

  await prisma.milkingRecord.create({
    data: { cowId: null, shift, litres, date, enteredBy: user.name },
  });

  refresh();
  return { success: true, message: "Herd/group total saved." };
}
