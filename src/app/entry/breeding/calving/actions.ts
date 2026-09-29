"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqId, optEnum, optNum, optText } from "@/lib/validate";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

const DIFFICULTIES = ["UNASSISTED", "EASY_PULL", "HARD_PULL", "VET_ASSISTED", "CAESAREAN"] as const;
const SEXES = ["FEMALE", "MALE", "UNKNOWN"] as const;
const OUTCOMES = ["ALIVE", "STILLBORN", "DIED_WITHIN_24H"] as const;

// A cow can't have been "inseminated for" a calving outside this window; a
// longer gap means the nearest earlier insemination was an earlier, failed
// cycle and shouldn't be linked to this calving.
const MIN_GESTATION_DAYS = 200;
const MAX_GESTATION_DAYS = 340;

export async function recordCalving(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => recordCalvingImpl(formData));
}

async function recordCalvingImpl(formData: FormData): Promise<FormState> {
  const user = await requirePermission("breeding", "CREATE");

  const damId = reqId(formData, "damId", "Dam");
  const date = reqDate(formData, "date", "Calving date");
  const sireTag = optText(formData, "sireTag", "Sire tag", { max: 50 });
  const difficulty = optEnum(formData, "difficulty", "Difficulty", DIFFICULTIES) ?? "UNASSISTED";
  const assistedBy = optText(formData, "assistedBy", "Assisted by", { max: 100 });
  const retainedPlacenta = formData.get("retainedPlacenta") === "on";
  const complications = optText(formData, "complications", "Complications", { max: 1000 });
  const calfCountRaw = optNum(formData, "calfCount", "Number of calves", { min: 1, max: 4, decimals: 0 });
  const calfCount = calfCountRaw ?? 1;
  const notes = optText(formData, "notes", "Notes", { max: 1000 });

  const calfSex = optEnum(formData, "calfSex", "Calf sex", SEXES) ?? "UNKNOWN";
  const calfOutcome = optEnum(formData, "calfOutcome", "Calf outcome", OUTCOMES) ?? "ALIVE";
  const calfWeight = optNum(formData, "calfWeight", "Calf birth weight", { positive: true, max: 100 });
  const calfTag = optText(formData, "calfTag", "Calf tag", { max: 40 });

  const dam = await prisma.cow.findUnique({ where: { id: damId } });
  if (!dam) throw new ValidationError("Dam not found.");
  if (dam.gender !== "FEMALE") throw new ValidationError("Only female animals can calve.");
  if (dam.status === "SOLD" || dam.status === "DEAD") {
    throw new ValidationError(`Cow ${dam.tag} is marked ${dam.status} and cannot receive new calving records.`);
  }

  const sameDay = await prisma.calving.findFirst({ where: { damId, date }, select: { id: true } });
  if (sameDay) {
    throw new ValidationError(`Cow ${dam.tag} already has a calving recorded on that date. It was not saved again.`);
  }

  const insemination = await prisma.insemination.findFirst({
    where: { cowId: damId, date: { lte: date } },
    orderBy: { date: "desc" },
  });
  const rawGestation = insemination
    ? Math.round((date.getTime() - insemination.date.getTime()) / 86_400_000)
    : null;
  const linkInsemination =
    insemination !== null && rawGestation !== null && rawGestation >= MIN_GESTATION_DAYS && rawGestation <= MAX_GESTATION_DAYS;
  const gestationDays = linkInsemination ? rawGestation : null;

  if (calfTag) {
    const existingTag = await prisma.cow.findUnique({ where: { tag: calfTag } });
    if (existingTag) throw new ValidationError(`Calf tag "${calfTag}" is already in use by another animal.`);
  }

  // Only a calving newer than (or equal to) her latest one changes the dam's
  // *current* state. Back-entering an older calving must not roll her last
  // calving date backwards, reset her status or inflate her lactation number.
  const isLatest = !dam.lastCalvingDate || date >= dam.lastCalvingDate;

  const result = await prisma.$transaction(async (tx) => {
    const calving = await tx.calving.create({
      data: {
        damId,
        inseminationId: linkInsemination ? (insemination?.id ?? null) : null,
        sireTag,
        date,
        gestationDays,
        difficulty,
        assistedBy,
        retainedPlacenta,
        complications,
        calfCount,
        notes,
        enteredBy: user.name,
      },
    });

    let newCowId: string | null = null;
    if (calfTag && calfOutcome === "ALIVE") {
      const newCow = await tx.cow.create({
        data: {
          tag: calfTag,
          gender: calfSex,
          status: "CALF",
          dateOfBirth: date,
          notes: `Born ${date.toISOString().slice(0, 10)} to dam ${dam.tag}.`,
        },
      });
      newCowId = newCow.id;
    }

    await tx.calf.create({
      data: {
        calvingId: calving.id,
        cowId: newCowId,
        sex: calfSex,
        outcome: calfOutcome,
        birthWeight: calfWeight,
        tag: calfTag,
      },
    });

    if (isLatest) {
      await tx.cow.update({
        where: { id: damId },
        data: {
          lastCalvingDate: date,
          expectedCalving: null,
          dryDate: null,
          status: "MILKING",
          lactationNumber: { increment: 1 },
        },
      });
    }

    return calving;
  });

  revalidatePath("/entry/breeding/calving");
  revalidatePath("/admin/cows");
  revalidatePath("/admin/reports/breeding");
  revalidatePath("/admin/reports/herd");
  const historical = isLatest ? "" : " This is older than her latest calving, so her current status was left unchanged.";
  return { success: true, message: `Calving recorded for dam ${dam.tag} (calving id ${result.id.slice(0, 8)}).${historical}` };
}
