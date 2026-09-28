"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

export async function addInventoryItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = (formData.get("name") as string | null)?.trim();
  const unit = (formData.get("unit") as string | null)?.trim();
  const category = (formData.get("category") as string | null)?.trim() || null;
  const reorderLevelRaw = formData.get("reorderLevel") as string | null;

  if (!name || !unit) return { success: false, message: "Item name and unit are required." };

  const existing = await prisma.inventoryItem.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (existing) return { success: false, message: `An item named "${name}" already exists.` };

  const reorderLevel = reorderLevelRaw ? parseFloat(reorderLevelRaw) : null;
  await prisma.inventoryItem.create({
    data: { name, unit, category, reorderLevel: reorderLevel !== null && !Number.isNaN(reorderLevel) ? reorderLevel : null },
  });

  revalidatePath("/admin/inventory/items");
  revalidatePath("/admin/reports/inventory");
  return { success: true, message: `Item "${name}" added.` };
}

export async function toggleInventoryItemActive(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";
  await prisma.inventoryItem.update({ where: { id }, data: { active } });
  revalidatePath("/admin/inventory/items");
  revalidatePath("/admin/reports/inventory");
}

export async function recordInventoryTransaction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const itemId = formData.get("itemId") as string | null;
  const dateRaw = formData.get("date") as string | null;
  const direction = formData.get("direction") as string | null; // "IN" | "OUT"
  const quantityRaw = formData.get("quantity") as string | null;
  const costRaw = formData.get("cost") as string | null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  const quantity = quantityRaw ? parseFloat(quantityRaw) : NaN;
  if (!itemId || !dateRaw || !direction || Number.isNaN(quantity) || quantity <= 0) {
    return { success: false, message: "Please select an item, date, direction and a positive quantity." };
  }

  const cost = costRaw ? parseFloat(costRaw) : null;
  await prisma.inventoryTransaction.create({
    data: {
      itemId,
      date: new Date(dateRaw),
      direction: direction as "IN" | "OUT",
      quantity,
      cost: cost !== null && !Number.isNaN(cost) ? cost : null,
      notes,
      enteredBy: session?.user?.name ?? null,
    },
  });

  revalidatePath("/entry/inventory");
  revalidatePath("/admin/reports/inventory");
  return { success: true, message: "Inventory entry saved." };
}
