"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

export async function submitMilkUsage(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const dateRaw = formData.get("date") as string | null;
  const type = formData.get("type") as string | null; // "CALF_USE" | "FARM_USE" | "EMPLOYEE_USE"
  const litresRaw = formData.get("litres") as string | null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  const litres = litresRaw ? parseFloat(litresRaw) : NaN;
  if (!dateRaw || !type || Number.isNaN(litres) || litres <= 0) {
    return { success: false, message: "Please fill in date, use type and a positive quantity." };
  }

  await prisma.milkUsageRecord.create({
    data: {
      date: new Date(dateRaw),
      type: type as "CALF_USE" | "FARM_USE" | "EMPLOYEE_USE",
      litres,
      notes,
      enteredBy: session?.user?.name ?? null,
    },
  });

  revalidatePath("/admin/reports/reconciliation");
  revalidatePath("/entry/milk-sale");
  return { success: true, message: "Milk use recorded." };
}
