"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

export async function addCapitalEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  const dateRaw = formData.get("date") as string | null;
  const partner = (formData.get("partner") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();
  const direction = formData.get("direction") as string | null; // CONTRIBUTION | WITHDRAWAL
  const amountRaw = formData.get("amount") as string | null;
  const venture = (formData.get("venture") as string | null)?.trim() || null;

  const amount = amountRaw ? parseFloat(amountRaw) : NaN;
  if (!dateRaw || !partner || !description || !direction || Number.isNaN(amount) || amount <= 0) {
    return { success: false, message: "Please fill in date, partner, description, direction and a positive amount." };
  }

  await prisma.capitalEntry.create({
    data: {
      date: new Date(dateRaw),
      partner,
      description,
      type: direction as "CONTRIBUTION" | "WITHDRAWAL",
      credit: direction === "CONTRIBUTION" ? amount : 0,
      debit: direction === "WITHDRAWAL" ? amount : 0,
      venture,
    },
  });

  revalidatePath("/admin/capital");
  return { success: true, message: "Capital entry saved." };
}
