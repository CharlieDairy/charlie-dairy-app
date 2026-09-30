"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqEnum, reqId, optEnum, optText } from "@/lib/validate";
import { revalidatePath } from "next/cache";
import { calcExpectedCalvingDate, calcExpectedDryOffDate } from "@/lib/breeding/rules";

export type FormState = { success: boolean; message: string } | undefined;

const METHODS = ["PALPATION", "ULTRASOUND", "BLOOD_TEST", "OBSERVATION"] as const;
const RESULTS = ["PREGNANT", "OPEN", "INCONCLUSIVE"] as const;

export async function recordPregnancyCheck(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => recordPregnancyCheckImpl(formData));
}

async function recordPregnancyCheckImpl(formData: FormData): Promise<FormState> {
  const user = await requirePermission("breeding", "CREATE");

  const cowId = reqId(formData, "cowId", "Cow");
  const date = reqDate(formData, "date", "Date");
  const method = optEnum(formData, "method", "Method", METHODS) ?? "PALPATION";
  const result = reqEnum(formData, "result", "Result", RESULTS);
  const notes = optText(formData, "notes", "Notes", { max: 1000 });
  const performedBy = optText(formData, "performedBy", "Performed by", { max: 100 }) ?? user.name;

  const cow = await prisma.cow.findUnique({ where: { id: cowId } });
  if (!cow) throw new ValidationError("Cow not found.");
  if (cow.gender !== "FEMALE") throw new ValidationError("Only female animals can have a pregnancy check.");
  if (cow.status === "SOLD" || cow.status === "DEAD") {
    throw new ValidationError(`Cow ${cow.tag} is marked ${cow.status} and cannot receive new breeding events.`);
  }

  const duplicate = await prisma.pregnancyCheck.findFirst({
    where: { cowId, date, result, createdAt: { gte: new Date(Date.now() - 120_000) } },
    select: { id: true },
  });
  if (duplicate) throw new ValidationError("This pregnancy check was just recorded, so it wasn't saved twice.");

  // Link to the most recent insemination on/before this check date, if any.
  const insemination = await prisma.insemination.findFirst({
    where: { cowId, date: { lte: date } },
    orderBy: { date: "desc" },
  });

  // Only a check newer than (or equal to) her latest existing one should
  // change the dam's *current* reproductive state -- same guard calving
  // already uses (src/app/entry/breeding/calving/actions.ts `isLatest`).
  // Without it, backdating an old check (or recording checks out of order)
  // can overwrite expectedCalving/dryDate with stale data.
  const latestExisting = await prisma.pregnancyCheck.findFirst({
    where: { cowId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const isLatest = !latestExisting || date >= latestExisting.date;

  await prisma.$transaction(async (tx) => {
    await tx.pregnancyCheck.create({
      data: { cowId, inseminationId: insemination?.id ?? null, date, method, result, notes, performedBy },
    });

    if (!isLatest) return;

    if (result === "PREGNANT") {
      const conceptionDate = insemination?.date ?? date;
      const expectedCalving = calcExpectedCalvingDate(conceptionDate);
      const dryDate = calcExpectedDryOffDate(expectedCalving);
      await tx.cow.update({ where: { id: cowId }, data: { expectedCalving, dryDate } });
    } else if (result === "OPEN") {
      await tx.cow.update({ where: { id: cowId }, data: { expectedCalving: null, dryDate: null } });
    }
  });

  revalidatePath("/entry/breeding/pregnancy-check");
  revalidatePath("/entry/breeding/reproduction");
  revalidatePath("/admin/cows");
  revalidatePath("/admin/reports/breeding");
  const historical = isLatest ? "" : " This is older than her latest check, so her current status was left unchanged.";
  return { success: true, message: `Pregnancy check (${result}) recorded for cow ${cow.tag}.${historical}` };
}
