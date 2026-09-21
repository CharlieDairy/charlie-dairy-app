"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

export async function submitMilkSale(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const dateRaw = formData.get("date") as string | null;
  const buyer = (formData.get("buyer") as string | null)?.trim();
  const litresRaw = formData.get("litres") as string | null;
  const rateRaw = formData.get("rate") as string | null;
  const amountRaw = formData.get("amount") as string | null;

  const litres = litresRaw ? parseFloat(litresRaw) : NaN;
  const rate = rateRaw ? parseFloat(rateRaw) : null;
  let amount = amountRaw ? parseFloat(amountRaw) : NaN;
  if (Number.isNaN(amount) && rate && !Number.isNaN(litres)) {
    amount = rate * litres;
  }

  if (!dateRaw || !buyer || Number.isNaN(litres) || litres <= 0 || Number.isNaN(amount)) {
    return { success: false, message: "Please fill in date, buyer, litres and either rate or amount." };
  }

  await prisma.milkSale.create({
    data: {
      date: new Date(dateRaw),
      buyer,
      litres,
      rate: rate ?? undefined,
      amount,
      enteredBy: session?.user?.name ?? null,
    },
  });

  revalidatePath("/entry/milk-sale");
  return { success: true, message: "Milk sale entry saved." };
}
