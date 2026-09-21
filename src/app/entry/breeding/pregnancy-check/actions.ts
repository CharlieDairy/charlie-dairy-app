"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { calcExpectedCalvingDate, calcExpectedDryOffDate } from "@/lib/breeding/rules";

export type FormState = { success: boolean; message: string } | undefined;

export async function recordPregnancyCheck(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const cowId = formData.get("cowId") as string | null;
  const dateRaw = formData.get("date") as string | null;
  const method = (formData.get("method") as string | null) || "PALPATION";
  const result = formData.get("result") as string | null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const performedBy = (formData.get("performedBy") as string | null)?.trim() || session?.user?.name || null;

  if (!cowId || !dateRaw || !result) {
    return { success: false, message: "Cow, date and result are required." };
  }

  const cow = await prisma.cow.findUnique({ where: { id: cowId } });
  if (!cow) return { success: false, message: "Cow not found." };
  if (cow.gender !== "FEMALE") return { success: false, message: "Only female animals can have a pregnancy check." };

  const date = new Date(dateRaw);

  // Link to the most recent insemination on/before this check date, if any.
  const insemination = await prisma.insemination.findFirst({
    where: { cowId, date: { lte: date } },
    orderBy: { date: "desc" },
  });

  await prisma.$transaction(async (tx) => {
    await tx.pregnancyCheck.create({
      data: {
        cowId,
        inseminationId: insemination?.id ?? null,
        date,
        method: method as "PALPATION" | "ULTRASOUND" | "BLOOD_TEST" | "OBSERVATION",
        result: result as "PREGNANT" | "OPEN" | "INCONCLUSIVE",
        notes,
        performedBy,
      },
    });

    if (result === "PREGNANT") {
      const conceptionDate = insemination?.date ?? date;
      const expectedCalving = calcExpectedCalvingDate(conceptionDate);
      const dryDate = calcExpectedDryOffDate(expectedCalving);
      await tx.cow.update({
        where: { id: cowId },
        data: { expectedCalving, dryDate },
      });
    } else if (result === "OPEN") {
      await tx.cow.update({
        where: { id: cowId },
        data: { expectedCalving: null, dryDate: null },
      });
    }
  });

  revalidatePath("/entry/breeding/pregnancy-check");
  revalidatePath("/admin/cows");
  revalidatePath("/admin/reports/breeding");
  return { success: true, message: `Pregnancy check (${result}) recorded for cow ${cow.tag}.` };
}
