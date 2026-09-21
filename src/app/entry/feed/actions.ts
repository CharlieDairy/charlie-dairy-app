"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

export async function submitFeed(_prev: FormState, formData: FormData): Promise<FormState> {
  const dateRaw = formData.get("date") as string | null;
  const feedType = (formData.get("feedType") as string | null)?.trim();
  const direction = formData.get("direction") as string | null; // "IN" | "OUT"
  const quantityRaw = formData.get("quantity") as string | null;
  const rateRaw = formData.get("rate") as string | null;

  const quantity = quantityRaw ? parseFloat(quantityRaw) : NaN;
  if (!dateRaw || !feedType || !direction || Number.isNaN(quantity) || quantity <= 0) {
    return { success: false, message: "Please fill in date, feed type, direction and a positive quantity." };
  }
  const rate = rateRaw ? parseFloat(rateRaw) : null;

  await prisma.feedTransaction.create({
    data: {
      date: new Date(dateRaw),
      feedType,
      direction: direction as "IN" | "OUT",
      quantity,
      rate: rate ?? undefined,
      cost: rate && direction === "OUT" ? rate * quantity : undefined,
    },
  });

  revalidatePath("/entry/feed");
  return { success: true, message: "Feed entry saved." };
}
