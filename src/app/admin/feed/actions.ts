"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

export async function addFeedItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = (formData.get("name") as string | null)?.trim();
  const unit = (formData.get("unit") as string | null)?.trim();
  const category = (formData.get("category") as string | null)?.trim() || null;
  const reorderLevelRaw = formData.get("reorderLevel") as string | null;

  if (!name || !unit) return { success: false, message: "Feed name and unit are required." };

  const existing = await prisma.feedItem.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (existing) return { success: false, message: `A feed item named "${name}" already exists.` };

  const reorderLevel = reorderLevelRaw ? parseFloat(reorderLevelRaw) : null;
  await prisma.feedItem.create({
    data: { name, unit, category, reorderLevel: reorderLevel !== null && !Number.isNaN(reorderLevel) ? reorderLevel : null },
  });

  revalidatePath("/admin/feed/items");
  revalidatePath("/admin/reports/feed");
  revalidatePath("/entry/feed");
  return { success: true, message: `Feed item "${name}" added.` };
}

export async function toggleFeedItemActive(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";
  await prisma.feedItem.update({ where: { id }, data: { active } });
  revalidatePath("/admin/feed/items");
  revalidatePath("/admin/reports/feed");
  revalidatePath("/entry/feed");
}
