"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, assertNotBackdated, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqId, optId, optEnum, optNum, optText } from "@/lib/validate";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

const METHODS = ["AI", "NATURAL", "EMBRYO_TRANSFER"] as const;

export async function recordInsemination(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => recordInseminationImpl(formData));
}

async function recordInseminationImpl(formData: FormData): Promise<FormState> {
  const user = await requirePermission("breeding", "CREATE");

  const cowId = reqId(formData, "cowId", "Cow");
  const date = reqDate(formData, "date", "Date");
  assertNotBackdated(date, user, "Date");
  const method = optEnum(formData, "method", "Method", METHODS) ?? "AI";
  const semenBatch = optText(formData, "semenBatch", "Semen batch", { max: 100 });
  const bullTag = optText(formData, "bullTag", "Bull tag", { max: 50 });
  const technician = optText(formData, "technician", "Technician", { max: 100 });
  const cost = optNum(formData, "cost", "Cost", { max: 10_000_000 });
  const notes = optText(formData, "notes", "Notes", { max: 1000 });
  const heatEventId = optId(formData, "heatEventId", "Heat event");

  const cow = await prisma.cow.findUnique({ where: { id: cowId } });
  if (!cow) throw new ValidationError("Cow not found.");
  if (cow.gender !== "FEMALE") throw new ValidationError("Only female animals can be inseminated.");
  if (cow.status === "SOLD" || cow.status === "DEAD") {
    throw new ValidationError(`Cow ${cow.tag} is marked ${cow.status} and cannot receive new breeding events.`);
  }
  if (cow.lastCalvingDate && date < cow.lastCalvingDate) {
    throw new ValidationError(`That date is before cow ${cow.tag}'s last calving (${cow.lastCalvingDate.toISOString().slice(0, 10)}).`);
  }

  const sameDay = await prisma.insemination.findFirst({ where: { cowId, date }, select: { id: true } });
  if (sameDay) {
    throw new ValidationError(`Cow ${cow.tag} already has an insemination recorded on that date. It was not saved again.`);
  }

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
      method,
      semenBatch,
      bullTag,
      technician,
      serviceNumber: priorCount + 1,
      cost,
      notes,
      enteredBy: user.name,
      heatEventId,
    },
  });

  revalidatePath("/entry/breeding/ai");
  revalidatePath("/entry/breeding/reproduction");
  revalidatePath("/admin/reports/breeding");
  return { success: true, message: `Insemination #${priorCount + 1} recorded for cow ${cow.tag}.` };
}
