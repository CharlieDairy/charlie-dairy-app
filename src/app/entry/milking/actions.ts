"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

export async function submitMilking(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const cowId = formData.get("cowId") as string | null;
  const shift = formData.get("shift") as string | null;
  const litresRaw = formData.get("litres") as string | null;
  const dateRaw = formData.get("date") as string | null;

  const litres = litresRaw ? parseFloat(litresRaw) : NaN;
  if (!cowId || !shift || !dateRaw || Number.isNaN(litres) || litres < 0) {
    return { success: false, message: "Please fill in all fields with valid values." };
  }

  await prisma.milkingRecord.create({
    data: {
      cowId,
      shift: shift as "MORNING" | "AFTERNOON" | "EVENING",
      litres,
      date: new Date(dateRaw),
      enteredBy: session?.user?.name ?? null,
    },
  });

  revalidatePath("/entry/milking");
  return { success: true, message: "Milking entry saved." };
}
