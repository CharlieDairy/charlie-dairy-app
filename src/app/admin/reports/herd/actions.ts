"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAccess, requirePermission, runAction } from "@/lib/access";
import { periodRange, type PeriodKey } from "@/lib/reports/herd";

export type BulkDeleteState = { success: boolean; message: string } | undefined;

const PERIOD_KEYS: PeriodKey[] = ["day", "week", "month", "year", "all"];

// Admin-only: a row on this report IS a cow's milk production history, so
// unlike the Animal List's bulk delete there's no "safe" subset to skip --
// selecting a row and deleting it means clearing that cow's MilkingRecord
// history FOR THE PERIOD CURRENTLY SHOWN, not its entire history -- the
// report is period-filtered, and the delete must match what's on screen,
// not silently reach outside it. The cow itself is untouched; use the
// Animal List to delete the animal record.
export async function deleteMilkProductionForCows(_prev: BulkDeleteState, formData: FormData): Promise<BulkDeleteState> {
  return runAction(() => deleteMilkProductionForCowsImpl(_prev, formData));
}

async function deleteMilkProductionForCowsImpl(_prev: BulkDeleteState, formData: FormData): Promise<BulkDeleteState> {
  await requirePermission("milk", "DELETE");
  await requireAccess({ admin: true });

  const cowIds = formData.getAll("cowIds") as string[];
  if (cowIds.length === 0) return { success: false, message: "No rows selected." };

  const periodParam = formData.get("period");
  const period: PeriodKey = typeof periodParam === "string" && (PERIOD_KEYS as string[]).includes(periodParam)
    ? (periodParam as PeriodKey)
    : "all";
  const range = periodRange(period);

  const { count } = await prisma.milkingRecord.deleteMany({
    where: { cowId: { in: cowIds }, ...(range ? { date: { gte: range.start, lt: range.end } } : {}) },
  });

  revalidatePath("/admin/reports/herd");
  revalidatePath("/admin/reports/reconciliation");
  revalidatePath("/admin");
  const scopeNote = range ? " for the selected period" : " (all time)";
  return { success: true, message: `Deleted ${count} milking record${count === 1 ? "" : "s"}${scopeNote} for ${cowIds.length} animal${cowIds.length === 1 ? "" : "s"}.` };
}
