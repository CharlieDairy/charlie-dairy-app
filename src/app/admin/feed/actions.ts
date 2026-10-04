"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, runAction } from "@/lib/access";
import { reqId, reqText, optText, optNum } from "@/lib/validate";

export type FormState = { success: boolean; message: string } | undefined;

export async function addFeedItem(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => addFeedItemImpl(formData));
}

async function addFeedItemImpl(formData: FormData): Promise<FormState> {
  await requirePermission("feed", "CREATE");
  const name = reqText(formData, "name", "Feed name", { max: 100 });
  const unit = reqText(formData, "unit", "Unit", { max: 20 });
  const category = optText(formData, "category", "Category", { max: 100 });
  const reorderLevel = optNum(formData, "reorderLevel", "Reorder level", { max: 10_000_000 });

  const existing = await prisma.feedItem.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (existing) return { success: false, message: `A feed item named "${name}" already exists.` };

  await prisma.feedItem.create({ data: { name, unit, category, reorderLevel } });

  revalidatePath("/admin/feed/items");
  revalidatePath("/admin/reports/feed");
  revalidatePath("/entry/feed");
  return { success: true, message: `Feed item "${name}" added.` };
}

export async function toggleFeedItemActive(formData: FormData): Promise<void> {
  await requirePermission("feed", "EDIT");
  const id = reqId(formData, "id", "Feed item");
  const active = formData.get("active") === "true";
  await prisma.feedItem.updateMany({ where: { id }, data: { active } });
  revalidatePath("/admin/feed/items");
  revalidatePath("/admin/reports/feed");
  revalidatePath("/entry/feed");
}
