"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

export async function addCow(_prev: FormState, formData: FormData): Promise<FormState> {
  const tag = (formData.get("tag") as string | null)?.trim();
  const gender = formData.get("gender") as string | null;
  const status = formData.get("status") as string | null;
  const dateOfBirthRaw = formData.get("dateOfBirth") as string | null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  if (!tag || !gender || !status) {
    return { success: false, message: "Tag, gender and status are required." };
  }

  const existing = await prisma.cow.findUnique({ where: { tag } });
  if (existing) {
    return { success: false, message: `Cow tag "${tag}" already exists.` };
  }

  await prisma.cow.create({
    data: {
      tag,
      gender: gender as "FEMALE" | "MALE" | "UNKNOWN",
      status: status as never,
      dateOfBirth: dateOfBirthRaw ? new Date(dateOfBirthRaw) : null,
      notes,
    },
  });

  revalidatePath("/admin/cows");
  return { success: true, message: `Cow ${tag} added.` };
}

export async function updateCowStatus(formData: FormData): Promise<void> {
  const cowId = formData.get("cowId") as string;
  const status = formData.get("status") as string;
  await prisma.cow.update({ where: { id: cowId }, data: { status: status as never } });
  revalidatePath("/admin/cows");
}

export type DeleteState = { success: boolean; message: string } | undefined;

// Deliberately conservative: a cow with any recorded history (milking,
// calvings, breeding events, or being a registered calf of another calving)
// can't be hard-deleted — that would destroy real production/financial
// history. Use a status change (Sold/Dead) for those instead. This only
// clears genuinely empty entries, e.g. a duplicate or mistyped tag.
export async function deleteCow(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const cowId = formData.get("cowId") as string | null;
  if (!cowId) return { success: false, message: "Missing cow id." };

  const cow = await prisma.cow.findUnique({ where: { id: cowId } });
  if (!cow) return { success: false, message: "Cow not found." };

  const [milking, calvingsAsDam, heat, ai, preg, calfRecord] = await Promise.all([
    prisma.milkingRecord.count({ where: { cowId } }),
    prisma.calving.count({ where: { damId: cowId } }),
    prisma.heatEvent.count({ where: { cowId } }),
    prisma.insemination.count({ where: { cowId } }),
    prisma.pregnancyCheck.count({ where: { cowId } }),
    prisma.calf.findUnique({ where: { cowId } }),
  ]);

  const linkedCount = milking + calvingsAsDam + heat + ai + preg + (calfRecord ? 1 : 0);
  if (linkedCount > 0) {
    return {
      success: false,
      message: `Cow ${cow.tag} has recorded history (milking, breeding or calving records) and can't be deleted. Set its status to Sold or Dead instead to keep the history intact.`,
    };
  }

  await prisma.cow.delete({ where: { id: cowId } });
  revalidatePath("/admin/cows");
  return { success: true, message: `Cow ${cow.tag} deleted.` };
}
