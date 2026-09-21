"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

export async function recordInsemination(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const cowId = formData.get("cowId") as string | null;
  const dateRaw = formData.get("date") as string | null;
  const method = (formData.get("method") as string | null) || "AI";
  const semenBatch = (formData.get("semenBatch") as string | null)?.trim() || null;
  const bullTag = (formData.get("bullTag") as string | null)?.trim() || null;
  const technician = (formData.get("technician") as string | null)?.trim() || null;
  const costRaw = formData.get("cost") as string | null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const heatEventId = (formData.get("heatEventId") as string | null) || null;

  if (!cowId || !dateRaw) {
    return { success: false, message: "Cow and date are required." };
  }

  const cow = await prisma.cow.findUnique({ where: { id: cowId } });
  if (!cow) return { success: false, message: "Cow not found." };
  if (cow.gender !== "FEMALE") return { success: false, message: "Only female animals can be inseminated." };
  if (cow.status === "SOLD" || cow.status === "DEAD") {
    return { success: false, message: `Cow ${cow.tag} is marked ${cow.status} and cannot receive new breeding events.` };
  }

  const cost = costRaw ? parseFloat(costRaw) : null;
  const date = new Date(dateRaw);

  // Service number: count prior inseminations since the last calving (or ever, if none).
  const priorCount = await prisma.insemination.count({
    where: {
      cowId,
      date: cow.lastCalvingDate ? { gte: cow.lastCalvingDate, lt: date } : { lt: date },
    },
  });

  await prisma.insemination.create({
    data: {
      cowId,
      date,
      method: method as "AI" | "NATURAL" | "EMBRYO_TRANSFER",
      semenBatch,
      bullTag,
      technician,
      serviceNumber: priorCount + 1,
      cost: cost !== null && !Number.isNaN(cost) ? cost : null,
      notes,
      enteredBy: session?.user?.name ?? null,
      heatEventId: heatEventId || null,
    },
  });

  revalidatePath("/entry/breeding/ai");
  revalidatePath("/admin/reports/breeding");
  return { success: true, message: `Insemination #${priorCount + 1} recorded for cow ${cow.tag}.` };
}
