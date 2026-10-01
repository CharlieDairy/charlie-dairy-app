"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqId, optNum } from "@/lib/validate";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

function refresh() {
  revalidatePath("/entry/milking");
  revalidatePath("/admin/reports/herd");
  revalidatePath("/admin/reports/reconciliation");
  revalidatePath("/admin");
}

const SHIFT_FIELDS = [
  { field: "morning", shift: "MORNING" as const, label: "Morning" },
  { field: "afternoon", shift: "AFTERNOON" as const, label: "Afternoon" },
  { field: "evening", shift: "EVENING" as const, label: "Evening" },
];

// One record per cow per date, all sessions together -- the Add Milk Record
// modal (modeled on Channab's "Individual Milk Records" popup) takes one
// animal + date and up to three session litres at once, so this creates one
// MilkingRecord per filled session in a single submission instead of the old
// one-shift-at-a-time form.
export async function submitMilking(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => submitMilkingImpl(formData));
}

async function submitMilkingImpl(formData: FormData): Promise<FormState> {
  const user = await requirePermission("milk", "CREATE");

  const cowId = reqId(formData, "cowId", "Cow");
  const date = reqDate(formData, "date", "Date");

  // Zero is a valid recorded milking (a cow that gave nothing); 200 L is well past any real single milking.
  const entries = SHIFT_FIELDS.map((s) => ({ ...s, litres: optNum(formData, s.field, s.label, { min: 0, max: 200 }) })).filter(
    (s): s is (typeof SHIFT_FIELDS)[number] & { litres: number } => s.litres !== null
  );
  if (entries.length === 0) {
    throw new ValidationError("Enter litres for at least one session.");
  }

  const cow = await prisma.cow.findUnique({ where: { id: cowId }, select: { tag: true, status: true } });
  if (!cow) throw new ValidationError("That cow was not found.");
  if (cow.status === "SOLD" || cow.status === "DEAD") {
    throw new ValidationError(`Cow ${cow.tag} is marked ${cow.status} and can't be milked.`);
  }

  // One record per cow per shift per day -- this is what stops a double tap
  // (or two people entering the same milking) from silently doubling production.
  const existing = await prisma.milkingRecord.findMany({
    where: { cowId, date, shift: { in: entries.map((e) => e.shift) } },
    select: { shift: true, litres: true },
  });
  if (existing.length > 0) {
    const names = existing.map((e) => e.shift.toLowerCase()).join(", ");
    throw new ValidationError(`Cow ${cow.tag} already has a recorded ${names} milking for that date. Nothing was saved.`);
  }

  // A herd/group total (cowId null) for this same date+shift already covers
  // this cow's production in the farm-wide sum -- reports don't distinguish
  // "individual rows that make up a group total" from "extra production on
  // top of it", so letting both exist would double-count when totalled.
  const groupExisting = await prisma.milkingRecord.findMany({
    where: { cowId: null, date, shift: { in: entries.map((e) => e.shift) } },
    select: { shift: true },
  });
  if (groupExisting.length > 0) {
    const names = groupExisting.map((e) => e.shift.toLowerCase()).join(", ");
    throw new ValidationError(
      `A herd/group total already covers the ${names} shift on that date. Record individual cows for a shift either all together or as one group total, not both.`
    );
  }

  await prisma.milkingRecord.createMany({
    data: entries.map((e) => ({ cowId, shift: e.shift, litres: e.litres, date, enteredBy: user.name })),
  });

  refresh();
  const sessionNames = entries.map((e) => e.label).join(", ");
  return { success: true, message: `Saved ${sessionNames} for cow ${cow.tag}.` };
}
