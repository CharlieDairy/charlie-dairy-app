"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { saveUploadedImage, deleteUploadedImage } from "@/lib/uploadImage";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

export async function addCow(_prev: FormState, formData: FormData): Promise<FormState> {
  const tag = (formData.get("tag") as string | null)?.trim();
  const breed = (formData.get("breed") as string | null)?.trim() || null;
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
      breed,
      gender: gender as "FEMALE" | "MALE" | "UNKNOWN",
      status: status as never,
      dateOfBirth: dateOfBirthRaw ? new Date(dateOfBirthRaw) : null,
      notes,
    },
  });

  revalidatePath("/admin/cows");
  return { success: true, message: `Cow ${tag} added.` };
}

// Herd Management: purchase price / source / photo, editable after creation
// from the cow's profile page (mirrors the Assets edit pattern).
export async function updateCowDetails(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = formData.get("id") as string | null;
  const breed = (formData.get("breed") as string | null)?.trim() || null;
  const condition = (formData.get("condition") as string | null)?.trim() || null;
  const purchasePriceRaw = formData.get("purchasePrice") as string | null;
  const source = (formData.get("source") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const photo = formData.get("photo") as File | null;
  const removePhoto = formData.get("removePhoto") === "on";

  if (!id) return { success: false, message: "Missing cow id." };
  const existing = await prisma.cow.findUnique({ where: { id } });
  if (!existing) return { success: false, message: "Cow not found." };

  const purchasePrice = purchasePriceRaw ? parseFloat(purchasePriceRaw) : null;

  let photoUrl = existing.photoUrl;
  if (photo && photo.size > 0) {
    const uploaded = await saveUploadedImage(photo, "cows");
    if (uploaded.error) return { success: false, message: uploaded.error };
    if (uploaded.url) {
      await deleteUploadedImage(existing.photoUrl);
      photoUrl = uploaded.url;
    }
  } else if (removePhoto) {
    await deleteUploadedImage(existing.photoUrl);
    photoUrl = null;
  }

  await prisma.cow.update({
    where: { id },
    data: {
      breed,
      condition,
      purchasePrice: purchasePrice !== null && !Number.isNaN(purchasePrice) ? purchasePrice : null,
      source,
      notes,
      photoUrl,
    },
  });

  revalidatePath(`/admin/cows/${id}`);
  revalidatePath("/admin/cows");
  return { success: true, message: "Cow details updated." };
}

export async function addWeightRecord(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const cowId = formData.get("cowId") as string | null;
  const dateRaw = formData.get("date") as string | null;
  const weightRaw = formData.get("weightKg") as string | null;

  const weightKg = weightRaw ? parseFloat(weightRaw) : NaN;
  if (!cowId || !dateRaw || Number.isNaN(weightKg) || weightKg <= 0) {
    return { success: false, message: "Date and a positive weight are required." };
  }

  await prisma.weightRecord.create({
    data: { cowId, date: new Date(dateRaw), weightKg, enteredBy: session?.user?.name ?? null },
  });

  revalidatePath(`/admin/cows/${cowId}`);
  return { success: true, message: `Weight recorded: ${weightKg} kg.` };
}

export async function addCowMovement(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const cowId = formData.get("cowId") as string | null;
  const dateRaw = formData.get("date") as string | null;
  const location = (formData.get("location") as string | null)?.trim();
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  if (!cowId || !dateRaw || !location) {
    return { success: false, message: "Date and location are required." };
  }

  await prisma.cowMovement.create({
    data: { cowId, date: new Date(dateRaw), location, notes, enteredBy: session?.user?.name ?? null },
  });

  revalidatePath(`/admin/cows/${cowId}`);
  return { success: true, message: `Moved to ${location}.` };
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
