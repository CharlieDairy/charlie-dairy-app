"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export type BulkDeleteState = { success: boolean; message: string } | undefined;

// Admin-only: a row on this report IS a cow's milk production history, so
// unlike the Animal List's bulk delete there's no "safe" subset to skip --
// selecting a row and deleting it always means clearing that cow's
// MilkingRecord history. The cow itself is untouched; use the Animal List
// to delete the animal record.
export async function deleteMilkProductionForCows(_prev: BulkDeleteState, formData: FormData): Promise<BulkDeleteState> {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return { success: false, message: "Only Admin can bulk-delete milk production records." };
  }

  const cowIds = formData.getAll("cowIds") as string[];
  if (cowIds.length === 0) return { success: false, message: "No rows selected." };

  const { count } = await prisma.milkingRecord.deleteMany({ where: { cowId: { in: cowIds } } });

  revalidatePath("/admin/reports/herd");
  revalidatePath("/admin/reports/reconciliation");
  revalidatePath("/admin");
  return { success: true, message: `Deleted ${count} milking record${count === 1 ? "" : "s"} for ${cowIds.length} animal${cowIds.length === 1 ? "" : "s"}.` };
}
