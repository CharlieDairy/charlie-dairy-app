"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

export async function addAsset(_prev: FormState, formData: FormData): Promise<FormState> {
  const assetClass = (formData.get("assetClass") as string | null)?.trim();
  const details = (formData.get("details") as string | null)?.trim();
  const qty = parseFloat((formData.get("qty") as string | null) ?? "");
  const currentValue = parseFloat((formData.get("currentValue") as string | null) ?? "");

  if (!assetClass || !details || Number.isNaN(qty) || Number.isNaN(currentValue)) {
    return { success: false, message: "Asset class, details, quantity and current value are required." };
  }

  await prisma.asset.create({
    data: {
      assetClass,
      details,
      qty,
      value: currentValue,
      currentValue,
      valuationDate: new Date(),
    },
  });

  revalidatePath("/admin/assets");
  return { success: true, message: `Asset "${details}" added.` };
}
