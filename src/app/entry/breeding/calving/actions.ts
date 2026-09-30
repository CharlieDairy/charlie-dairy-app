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

  // One set of fields per calf (calf_0_sex, calf_1_sex, ...) -- calfCount
  // used to accept 1-4 but the form and this action only ever captured one
  // calf's details, so twins/triplets lost independent sex/weight/outcome
  // and only ever got at most one new Cow record between them.
  const calves = Array.from({ length: calfCount }, (_, i) => ({
    sex: optEnum(formData, `calf_${i}_sex`, `Calf ${i + 1} sex`, SEXES) ?? "UNKNOWN",
    outcome: optEnum(formData, `calf_${i}_outcome`, `Calf ${i + 1} outcome`, OUTCOMES) ?? "ALIVE",
    weight: optNum(formData, `calf_${i}_weight`, `Calf ${i + 1} birth weight`, { positive: true, max: 100 }),
    tag: optText(formData, `calf_${i}_tag`, `Calf ${i + 1} tag`, { max: 40 }),
  }));

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

  const submittedTags = calves.map((c) => c.tag).filter((t): t is string => t !== null);
  const dupeTag = submittedTags.find((t, i) => submittedTags.indexOf(t) !== i);
  if (dupeTag) throw new ValidationError(`Tag "${dupeTag}" was entered for more than one calf in this calving.`);
  if (submittedTags.length > 0) {
    const existingTags = await prisma.cow.findMany({ where: { tag: { in: submittedTags } }, select: { tag: true } });
    if (existingTags.length > 0) {
      throw new ValidationError(`Tag "${existingTags[0].tag}" is already in use by another animal.`);
    }
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

    for (const c of calves) {
      let newCowId: string | null = null;
      if (c.tag && c.outcome === "ALIVE") {
        const newCow = await tx.cow.create({
          data: {
            tag: c.tag,
            gender: c.sex,
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
          sex: c.sex,
          outcome: c.outcome,
          birthWeight: c.weight,
          tag: c.tag,
        },
      });
    }

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
  const calfNote = calfCount > 1 ? ` (${calfCount} calves recorded)` : "";
  return { success: true, message: `Calving recorded for dam ${dam.tag}${calfNote} (calving id ${result.id.slice(0, 8)}).${historical}` };
}
