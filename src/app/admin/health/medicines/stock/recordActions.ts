"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, assertDateChangeNotBackdated, runAction } from "@/lib/access";
import { reqDate, reqId, reqNum, optNum, optText } from "@/lib/validate";
import { revalidatePath } from "next/cache";

// Edit and delete for medicine RESTOCK entries (IN). Stock used by a
// treatment (OUT) is changed by editing or deleting that treatment on the
// animal's profile, so it is not editable here.

export type FormState = { success: boolean; message: string } | undefined;

const gone: FormState = { success: false, message: "That entry no longer exists. Refresh the page." };

function refresh() {
  revalidatePath("/admin/health/medicines/stock");
  revalidatePath("/admin/health/medicines");
}

export async function updateRestock(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await requirePermission("health", "EDIT");
    const id = reqId(formData, "id", "Entry");
    const date = reqDate(formData, "date", "Date");
    const quantity = reqNum(formData, "quantity", "Quantity", { positive: true, max: 1_000_000 });
    const cost = optNum(formData, "cost", "Cost", { max: 10_000_000 });
    const notes = optText(formData, "notes", "Notes", { max: 500 });
    const existing = await prisma.medicineStockTransaction.findUnique({ where: { id } });
    if (!existing || existing.direction !== "IN") return gone;
    assertDateChangeNotBackdated(date, existing.date, user);
    await prisma.medicineStockTransaction.update({ where: { id }, data: { date, quantity, cost, notes } });
    refresh();
    return { success: true, message: "Restock updated." };
  });
}

export async function deleteRestock(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await requirePermission("health", "DELETE");
    const id = reqId(formData, "id", "Entry");
    const { count } = await prisma.medicineStockTransaction.deleteMany({ where: { id, direction: "IN" } });
    if (count === 0) return gone;
    refresh();
    return { success: true, message: "Restock deleted." };
  });
}
