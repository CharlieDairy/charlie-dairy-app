"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

export async function submitCash(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const dateRaw = formData.get("date") as string | null;
  const direction = formData.get("direction") as string | null; // "IN" | "OUT"
  const amountRaw = formData.get("amount") as string | null;
  const category = (formData.get("category") as string | null)?.trim();
  const remark = (formData.get("remark") as string | null)?.trim() || null;
  const party = (formData.get("party") as string | null)?.trim() || null;

  const amount = amountRaw ? parseFloat(amountRaw) : NaN;
  if (!dateRaw || !direction || !category || Number.isNaN(amount) || amount <= 0) {
    return { success: false, message: "Please fill in date, direction, category and a positive amount." };
  }

  await prisma.cashTransaction.create({
    data: {
      date: new Date(dateRaw),
      category,
      party,
      remark,
      mode: "CASH",
      amountIn: direction === "IN" ? amount : 0,
      amountOut: direction === "OUT" ? amount : 0,
      enteredBy: session?.user?.name ?? null,
    },
  });

  revalidatePath("/entry/cash");
  return { success: true, message: "Cash entry saved." };
}
