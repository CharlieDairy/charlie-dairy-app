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
  const fatPctRaw = formData.get("fatPct") as string | null;
  const snfPctRaw = formData.get("snfPct") as string | null;

  const litres = litresRaw ? parseFloat(litresRaw) : NaN;
  if (!cowId || !shift || !dateRaw || Number.isNaN(litres) || litres < 0) {
    return { success: false, message: "Please fill in all fields with valid values." };
  }

  const fatPct = fatPctRaw ? parseFloat(fatPctRaw) : NaN;
  const snfPct = snfPctRaw ? parseFloat(snfPctRaw) : NaN;

  await prisma.milkingRecord.create({
    data: {
      cowId,
      shift: shift as "MORNING" | "AFTERNOON" | "EVENING",
      litres,
      fatPct: !Number.isNaN(fatPct) ? fatPct : null,
      snfPct: !Number.isNaN(snfPct) ? snfPct : null,
      date: new Date(dateRaw),
      enteredBy: session?.user?.name ?? null,
    },
  });

  revalidatePath("/entry/milking");
  revalidatePath("/admin/reports/herd");
  revalidatePath("/admin/reports/reconciliation");
  revalidatePath("/admin");
  return { success: true, message: "Milking entry saved." };
}

// Channab's "Herd / Group Milk" fast path: one total for the whole herd/shift
// instead of per-cow detail. cowId is nullable on MilkingRecord specifically
// for this -- reports already treat a null cowId as an unattributed bulk
// total (see milkSession() in src/lib/reports/dashboardMetrics.ts), so no
// separate model or reconciliation-report change was needed.
export async function submitGroupMilking(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const shift = formData.get("shift") as string | null;
  const litresRaw = formData.get("litres") as string | null;
  const dateRaw = formData.get("date") as string | null;

  const litres = litresRaw ? parseFloat(litresRaw) : NaN;
  if (!shift || !dateRaw || Number.isNaN(litres) || litres < 0) {
    return { success: false, message: "Please fill in shift, date and a valid total." };
  }

  await prisma.milkingRecord.create({
    data: {
      cowId: null,
      shift: shift as "MORNING" | "AFTERNOON" | "EVENING",
      litres,
      date: new Date(dateRaw),
      enteredBy: session?.user?.name ?? null,
    },
  });

  revalidatePath("/entry/milking");
  revalidatePath("/admin/reports/herd");
  revalidatePath("/admin/reports/reconciliation");
  revalidatePath("/admin");
  return { success: true, message: "Herd/group total saved." };
}
