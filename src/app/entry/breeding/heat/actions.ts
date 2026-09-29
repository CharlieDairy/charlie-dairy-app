"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqEnum, reqId, optText } from "@/lib/validate";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

const DETECTION_METHODS = ["VISUAL", "ACTIVITY_MONITOR", "TAIL_PAINT", "OTHER"] as const;

export async function recordHeat(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => recordHeatImpl(formData));
}

async function recordHeatImpl(formData: FormData): Promise<FormState> {
  const user = await requirePermission("breeding", "CREATE");

  const cowId = reqId(formData, "cowId", "Cow");
  const detectedAt = reqDate(formData, "detectedAt", "Date/time");
  const detectionMethod = reqEnum(formData, "detectionMethod", "Detection method", DETECTION_METHODS);
  const intensity = optText(formData, "intensity", "Intensity", { max: 50 });
  const notes = optText(formData, "notes", "Notes", { max: 1000 });

  const cow = await prisma.cow.findUnique({ where: { id: cowId } });
  if (!cow) throw new ValidationError("Cow not found.");
  if (cow.gender !== "FEMALE") throw new ValidationError("Only female animals can have a heat event recorded.");
  if (cow.status === "SOLD" || cow.status === "DEAD") {
    throw new ValidationError(`Cow ${cow.tag} is marked ${cow.status} and cannot receive new breeding events.`);
  }

  const duplicate = await prisma.heatEvent.findFirst({
    where: { cowId, detectedAt, createdAt: { gte: new Date(Date.now() - 120_000) } },
    select: { id: true },
  });
  if (duplicate) throw new ValidationError("This heat event was just recorded, so it wasn't saved twice.");

  await prisma.heatEvent.create({
    data: { cowId, detectedAt, detectionMethod, intensity, notes, enteredBy: user.name },
  });

  revalidatePath("/entry/breeding/heat");
  revalidatePath("/admin/reports/breeding");
  return { success: true, message: `Heat recorded for cow ${cow.tag}.` };
}
