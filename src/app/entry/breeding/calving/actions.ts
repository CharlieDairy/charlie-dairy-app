"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

export async function recordCalving(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const damId = formData.get("damId") as string | null;
  const dateRaw = formData.get("date") as string | null;
  const sireTag = (formData.get("sireTag") as string | null)?.trim() || null;
  const difficulty = (formData.get("difficulty") as string | null) || "UNASSISTED";
  const assistedBy = (formData.get("assistedBy") as string | null)?.trim() || null;
  const retainedPlacenta = formData.get("retainedPlacenta") === "on";
  const complications = (formData.get("complications") as string | null)?.trim() || null;
  const calfCount = parseInt((formData.get("calfCount") as string | null) || "1", 10) || 1;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  const calfSex = (formData.get("calfSex") as string | null) || "UNKNOWN";
  const calfOutcome = (formData.get("calfOutcome") as string | null) || "ALIVE";
  const calfWeightRaw = formData.get("calfWeight") as string | null;
  const calfTag = (formData.get("calfTag") as string | null)?.trim() || null;

  if (!damId || !dateRaw) {
    return { success: false, message: "Dam and calving date are required." };
  }

  const dam = await prisma.cow.findUnique({ where: { id: damId } });
  if (!dam) return { success: false, message: "Dam not found." };
  if (dam.gender !== "FEMALE") return { success: false, message: "Only female animals can calve." };

  const date = new Date(dateRaw);
  const calfWeight = calfWeightRaw ? parseFloat(calfWeightRaw) : null;

  const insemination = await prisma.insemination.findFirst({
    where: { cowId: damId, date: { lte: date } },
    orderBy: { date: "desc" },
  });
  const gestationDays = insemination
    ? Math.round((date.getTime() - insemination.date.getTime()) / 86_400_000)
    : null;

  if (calfTag) {
    const existingTag = await prisma.cow.findUnique({ where: { tag: calfTag } });
    if (existingTag) return { success: false, message: `Calf tag "${calfTag}" is already in use by another animal.` };
  }

  const result = await prisma.$transaction(async (tx) => {
    const calving = await tx.calving.create({
      data: {
        damId,
        inseminationId: insemination?.id ?? null,
        sireTag,
        date,
        gestationDays,
        difficulty: difficulty as "UNASSISTED" | "EASY_PULL" | "HARD_PULL" | "VET_ASSISTED" | "CAESAREAN",
        assistedBy,
        retainedPlacenta,
        complications,
        calfCount,
        notes,
        enteredBy: session?.user?.name ?? null,
      },
    });

    let newCowId: string | null = null;
    if (calfTag && calfOutcome === "ALIVE") {
      const newCow = await tx.cow.create({
        data: {
          tag: calfTag,
          gender: calfSex as "FEMALE" | "MALE" | "UNKNOWN",
          status: "CALF",
          notes: `Born ${date.toISOString().slice(0, 10)} to dam ${dam.tag}.`,
        },
      });
      newCowId = newCow.id;
    }

    await tx.calf.create({
      data: {
        calvingId: calving.id,
        cowId: newCowId,
        sex: calfSex as "FEMALE" | "MALE" | "UNKNOWN",
        outcome: calfOutcome as "ALIVE" | "STILLBORN" | "DIED_WITHIN_24H",
        birthWeight: calfWeight !== null && !Number.isNaN(calfWeight) ? calfWeight : null,
        tag: calfTag,
      },
    });

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

    return calving;
  });

  revalidatePath("/entry/breeding/calving");
  revalidatePath("/admin/cows");
  revalidatePath("/admin/reports/breeding");
  revalidatePath("/admin/reports/herd");
  return { success: true, message: `Calving recorded for dam ${dam.tag} (calving id ${result.id.slice(0, 8)}).` };
}
