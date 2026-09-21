"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

export async function recordHeat(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const cowId = formData.get("cowId") as string | null;
  const detectedAtRaw = formData.get("detectedAt") as string | null;
  const detectionMethod = formData.get("detectionMethod") as string | null;
  const intensity = (formData.get("intensity") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  if (!cowId || !detectedAtRaw || !detectionMethod) {
    return { success: false, message: "Cow, date/time and detection method are required." };
  }

  const cow = await prisma.cow.findUnique({ where: { id: cowId } });
  if (!cow) return { success: false, message: "Cow not found." };
  if (cow.gender !== "FEMALE") return { success: false, message: "Only female animals can have a heat event recorded." };
  if (cow.status === "SOLD" || cow.status === "DEAD") {
    return { success: false, message: `Cow ${cow.tag} is marked ${cow.status} and cannot receive new breeding events.` };
  }

  await prisma.heatEvent.create({
    data: {
      cowId,
      detectedAt: new Date(detectedAtRaw),
      detectionMethod: detectionMethod as "VISUAL" | "ACTIVITY_MONITOR" | "TAIL_PAINT" | "OTHER",
      intensity,
      notes,
      enteredBy: session?.user?.name ?? null,
    },
  });

  revalidatePath("/entry/breeding/heat");
  revalidatePath("/admin/reports/breeding");
  return { success: true, message: `Heat recorded for cow ${cow.tag}.` };
}
