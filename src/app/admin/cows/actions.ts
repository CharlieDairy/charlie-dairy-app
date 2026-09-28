"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { saveUploadedImage, deleteUploadedImage } from "@/lib/uploadImage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type FormState = { success: boolean; message: string } | undefined;

export async function addCow(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const tag = (formData.get("tag") as string | null)?.trim();
  const breed = (formData.get("breed") as string | null)?.trim() || null;
  const gender = formData.get("gender") as string | null;
  const status = formData.get("status") as string | null;
  const dateOfBirthRaw = formData.get("dateOfBirth") as string | null;
  const purchaseDateRaw = formData.get("purchaseDate") as string | null;
  const purchasePriceRaw = formData.get("purchasePrice") as string | null;
  const location = (formData.get("location") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const photo = formData.get("photo") as File | null;
  const damTag = (formData.get("damTag") as string | null)?.trim() || null;
  const sireTag = (formData.get("sireTag") as string | null)?.trim() || null;

  if (!tag || !gender || !status) {
    return { success: false, message: "Tag, gender and status are required." };
  }

  const existing = await prisma.cow.findUnique({ where: { tag } });
  if (existing) {
    return { success: false, message: `Cow tag "${tag}" already exists.` };
  }

  // Linking a newborn to its mother reuses the same Calving/Calf records the
  // Calving entry flow creates, so lineage shows up consistently on both
  // profiles ("Born ... to dam ...", "Linked Children") regardless of which
  // form the birth was entered through.
  let dam: { id: string; tag: string } | null = null;
  if (damTag) {
    const found = await prisma.cow.findUnique({ where: { tag: damTag }, select: { id: true, tag: true, gender: true } });
    if (!found) return { success: false, message: `Mother tag "${damTag}" was not found.` };
    if (found.gender !== "FEMALE") return { success: false, message: `"${damTag}" is not recorded as female, so it can't be a mother.` };
    dam = found;
  }

  const purchasePrice = purchasePriceRaw ? parseFloat(purchasePriceRaw) : null;
  const dateOfBirth = dateOfBirthRaw ? new Date(dateOfBirthRaw) : null;

  let photoUrl: string | null = null;
  if (photo && photo.size > 0) {
    const uploaded = await saveUploadedImage(photo, "cows");
    if (uploaded.error) return { success: false, message: uploaded.error };
    photoUrl = uploaded.url;
  }

  const cow = await prisma.$transaction(async (tx) => {
    const newCow = await tx.cow.create({
      data: {
        tag,
        breed,
        gender: gender as "FEMALE" | "MALE" | "UNKNOWN",
        status: status as never,
        dateOfBirth,
        purchaseDate: purchaseDateRaw ? new Date(purchaseDateRaw) : null,
        purchasePrice: purchasePrice !== null && !Number.isNaN(purchasePrice) ? purchasePrice : null,
        notes,
        photoUrl,
      },
    });

    if (dam) {
      // Backfilling a past birth here is deliberately not treated as "the dam
      // just calved" -- it doesn't touch the dam's lastCalvingDate, status or
      // lactationNumber, since those should only reflect her most recent
      // calving as recorded through the actual Calving entry flow.
      const calving = await tx.calving.create({
        data: {
          damId: dam.id,
          sireTag,
          date: dateOfBirth ?? new Date(),
          calfCount: 1,
          notes: "Backfilled via Add Animal.",
          enteredBy: session?.user?.name ?? null,
        },
      });
      await tx.calf.create({
        data: {
          calvingId: calving.id,
          cowId: newCow.id,
          sex: gender as "FEMALE" | "MALE" | "UNKNOWN",
          outcome: "ALIVE",
          tag,
        },
      });
    }

    return newCow;
  });

  if (location) {
    await prisma.cowMovement.create({
      data: { cowId: cow.id, date: new Date(), location, enteredBy: session?.user?.name ?? null },
    });
  }

  revalidatePath("/admin/cows");
  redirect(`/admin/cows/${cow.id}`);
}

// Herd Management: purchase price / source / photo, editable after creation
// from the cow's profile page (mirrors the Assets edit pattern).
export async function updateCowDetails(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = formData.get("id") as string | null;
  const breed = (formData.get("breed") as string | null)?.trim() || null;
  const condition = (formData.get("condition") as string | null)?.trim() || null;
  const purchasePriceRaw = formData.get("purchasePrice") as string | null;
  const purchaseDateRaw = formData.get("purchaseDate") as string | null;
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
      purchaseDate: purchaseDateRaw ? new Date(purchaseDateRaw) : null,
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

export type BulkDeleteState = { success: boolean; message: string } | undefined;

// Multiple-select delete is Admin-only -- checked here server-side (not just
// hidden in the UI) since a Manager could otherwise call this action
// directly. Same conservative history guard as the single-cow delete: any
// cow with recorded milking/breeding/calving history is skipped, not force-
// deleted, so a batch selection can never silently destroy production data.
export async function deleteCows(_prev: BulkDeleteState, formData: FormData): Promise<BulkDeleteState> {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return { success: false, message: "Only Admin can delete multiple animals." };
  }

  const cowIds = formData.getAll("cowIds") as string[];
  if (cowIds.length === 0) return { success: false, message: "No animals selected." };

  const cows = await prisma.cow.findMany({ where: { id: { in: cowIds } } });
  const [milking, calvingsAsDam, heat, ai, preg, calves] = await Promise.all([
    prisma.milkingRecord.groupBy({ by: ["cowId"], where: { cowId: { in: cowIds } }, _count: true }),
    prisma.calving.groupBy({ by: ["damId"], where: { damId: { in: cowIds } }, _count: true }),
    prisma.heatEvent.groupBy({ by: ["cowId"], where: { cowId: { in: cowIds } }, _count: true }),
    prisma.insemination.groupBy({ by: ["cowId"], where: { cowId: { in: cowIds } }, _count: true }),
    prisma.pregnancyCheck.groupBy({ by: ["cowId"], where: { cowId: { in: cowIds } }, _count: true }),
    prisma.calf.findMany({ where: { cowId: { in: cowIds } }, select: { cowId: true } }),
  ]);
  const linkedIds = new Set([
    ...milking.map((m) => m.cowId),
    ...calvingsAsDam.map((c) => c.damId),
    ...heat.map((h) => h.cowId),
    ...ai.map((a) => a.cowId),
    ...preg.map((p) => p.cowId),
    ...calves.map((c) => c.cowId),
  ]);

  const deletable = cowIds.filter((id) => !linkedIds.has(id));
  const skipped = cows.filter((c) => linkedIds.has(c.id));

  if (deletable.length > 0) {
    await prisma.cow.deleteMany({ where: { id: { in: deletable } } });
  }

  revalidatePath("/admin/cows");
  if (skipped.length > 0) {
    return {
      success: deletable.length > 0,
      message: `Deleted ${deletable.length} of ${cowIds.length}. Skipped (has recorded history): ${skipped.map((c) => c.tag).join(", ")}.`,
    };
  }
  return { success: true, message: `Deleted ${deletable.length} animal${deletable.length === 1 ? "" : "s"}.` };
}
