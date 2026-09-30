"use server";

import { prisma } from "@/lib/prisma";
import { saveUploadedImage, deleteUploadedImage } from "@/lib/uploadImage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccess, requirePermission, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqEnum, reqId, reqNum, reqText, optDate, optNum, optText } from "@/lib/validate";

const GENDERS = ["FEMALE", "MALE", "UNKNOWN"] as const;
const STATUSES = ["MILKING", "DRY", "HEIFER", "CALF", "INSEMINATED", "SOLD", "DEAD"] as const;

export type FormState = { success: boolean; message: string } | undefined;

export async function addCow(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => addCowImpl(_prev, formData));
}

async function addCowImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("herd", "CREATE");
  const tag = reqText(formData, "tag", "Tag", { max: 40 });
  const breed = optText(formData, "breed", "Breed", { max: 100 });
  const gender = reqEnum(formData, "gender", "Gender", GENDERS);
  const status = reqEnum(formData, "status", "Status", STATUSES);
  const dateOfBirth = optDate(formData, "dateOfBirth", "Date of birth");
  const purchaseDate = optDate(formData, "purchaseDate", "Purchase date");
  const purchasePrice = optNum(formData, "purchasePrice", "Purchase price", { max: 100_000_000 });
  const location = optText(formData, "location", "Location", { max: 100 });
  const notes = optText(formData, "notes", "Notes", { max: 1000 });
  const photoField = formData.get("photo");
  const photo = photoField instanceof File ? photoField : null;
  const damTag = optText(formData, "damTag", "Mother tag", { max: 40 });
  const sireTag = optText(formData, "sireTag", "Sire tag", { max: 40 });

  if (dateOfBirth && purchaseDate && purchaseDate < dateOfBirth) {
    return { success: false, message: "Purchase date can't be before the date of birth." };
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

  let photoUrl: string | null = null;
  if (photo && photo.size > 0) {
    const uploaded = await saveUploadedImage(photo, "cows");
    if (uploaded.error) return { success: false, message: uploaded.error };
    photoUrl = uploaded.url;
  }

  let cow;
  try {
  cow = await prisma.$transaction(async (tx) => {
    const newCow = await tx.cow.create({
      data: {
        tag,
        breed,
        gender,
        status,
        dateOfBirth,
        purchaseDate,
        purchasePrice,
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
          enteredBy: user.name,
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
  } catch (e) {
    // Don't leave an orphaned photo in storage if the animal wasn't created.
    await deleteUploadedImage(photoUrl);
    throw e;
  }

  if (location) {
    await prisma.cowMovement.create({
      data: { cowId: cow.id, date: new Date(), location, enteredBy: user.name },
    });
  }

  revalidatePath("/admin/cows");
  redirect(`/admin/cows/${cow.id}`);
}

// Herd Management: purchase price / source / photo, editable after creation
// from the cow's profile page (mirrors the Assets edit pattern).
export async function updateCowDetails(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => updateCowDetailsImpl(_prev, formData));
}

async function updateCowDetailsImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission("herd", "EDIT");
  const id = reqId(formData, "id", "Cow");
  const breed = optText(formData, "breed", "Breed", { max: 100 });
  const condition = optText(formData, "condition", "Condition", { max: 100 });
  const purchasePrice = optNum(formData, "purchasePrice", "Purchase price", { max: 100_000_000 });
  const purchaseDate = optDate(formData, "purchaseDate", "Purchase date");
  const source = optText(formData, "source", "Source", { max: 200 });
  const notes = optText(formData, "notes", "Notes", { max: 1000 });
  const photoField = formData.get("photo");
  const photo = photoField instanceof File ? photoField : null;
  const removePhoto = formData.get("removePhoto") === "on";

  const existing = await prisma.cow.findUnique({ where: { id } });
  if (!existing) return { success: false, message: "Cow not found." };

  // Upload the new photo (if any) first, but don't delete the old blob yet --
  // if prisma.cow.update below fails, the database must still point at a
  // blob that actually exists. The old photo is only deleted once the new
  // URL (or null, for a removal) is confirmed committed.
  let photoUrl = existing.photoUrl;
  let newUploadUrl: string | null = null;
  let shouldRemovePhoto = false;
  if (photo && photo.size > 0) {
    const uploaded = await saveUploadedImage(photo, "cows");
    if (uploaded.error) return { success: false, message: uploaded.error };
    if (uploaded.url) {
      newUploadUrl = uploaded.url;
      photoUrl = uploaded.url;
    }
  } else if (removePhoto) {
    shouldRemovePhoto = true;
    photoUrl = null;
  }

  try {
    await prisma.cow.update({
      where: { id },
      data: {
        breed,
        condition,
        purchasePrice,
        purchaseDate,
        source,
        notes,
        photoUrl,
      },
    });
  } catch (e) {
    // The DB write didn't land -- clean up the newly uploaded blob (if any)
    // rather than the old one, so the cow's existing photo stays intact.
    if (newUploadUrl) await deleteUploadedImage(newUploadUrl);
    throw e;
  }

  if (newUploadUrl || shouldRemovePhoto) {
    await deleteUploadedImage(existing.photoUrl);
  }

  revalidatePath(`/admin/cows/${id}`);
  revalidatePath("/admin/cows");
  return { success: true, message: "Cow details updated." };
}

export async function addWeightRecord(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => addWeightRecordImpl(_prev, formData));
}

async function addWeightRecordImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("weight", "CREATE");
  const cowId = reqId(formData, "cowId", "Animal");
  const date = reqDate(formData, "date", "Date");
  const weightKg = reqNum(formData, "weightKg", "Weight", { positive: true, max: 2000, decimals: 1 });

  const cow = await prisma.cow.findUnique({ where: { id: cowId }, select: { id: true } });
  if (!cow) throw new ValidationError("Animal not found.");

  const duplicate = await prisma.weightRecord.findFirst({
    where: { cowId, date, weightKg, createdAt: { gte: new Date(Date.now() - 120_000) } },
    select: { id: true },
  });
  if (duplicate) throw new ValidationError("This weight was just recorded, so it wasn't saved twice.");

  await prisma.weightRecord.create({
    data: { cowId, date, weightKg, enteredBy: user.name },
  });

  revalidatePath(`/admin/cows/${cowId}`);
  return { success: true, message: `Weight recorded: ${weightKg} kg.` };
}

export async function addCowMovement(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => addCowMovementImpl(_prev, formData));
}

async function addCowMovementImpl(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("herd", "CREATE");
  const cowId = reqId(formData, "cowId", "Animal");
  const date = reqDate(formData, "date", "Date");
  const location = reqText(formData, "location", "Location", { max: 100 });
  const notes = optText(formData, "notes", "Notes", { max: 500 });

  const cow = await prisma.cow.findUnique({ where: { id: cowId }, select: { id: true } });
  if (!cow) throw new ValidationError("Animal not found.");

  await prisma.cowMovement.create({
    data: { cowId, date, location, notes, enteredBy: user.name },
  });

  revalidatePath(`/admin/cows/${cowId}`);
  return { success: true, message: `Moved to ${location}.` };
}

export async function updateCowStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => updateCowStatusImpl(formData));
}

async function updateCowStatusImpl(formData: FormData): Promise<FormState> {
  await requirePermission("herd", "EDIT");
  const cowId = reqId(formData, "cowId", "Cow");
  const status = reqEnum(formData, "status", "Status", STATUSES);

  // Sold/Dead animals aren't tracked for breeding anymore -- without this,
  // a cow marked pregnant (expectedCalving set) keeps showing a "Pregnant"
  // badge and matching the Pregnant quick-filter on the Animal List forever,
  // even though the herd-overview stat card already excludes Sold/Dead from
  // its own Pregnant count.
  const clearBreedingState = status === "SOLD" || status === "DEAD";

  await prisma.cow.updateMany({
    where: { id: cowId },
    data: clearBreedingState ? { status, expectedCalving: null, dryDate: null } : { status },
  });
  revalidatePath("/admin/cows");
  return { success: true, message: "Status updated." };
}

export type DeleteState = { success: boolean; message: string } | undefined;

// Deliberately conservative: a cow with any recorded history (milking,
// calvings, breeding events, or being a registered calf of another calving)
// can't be hard-deleted — that would destroy real production/financial
// history. Use a status change (Sold/Dead) for those instead. This only
// clears genuinely empty entries, e.g. a duplicate or mistyped tag.
export async function deleteCow(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  return runAction(() => deleteCowImpl(_prev, formData));
}

async function deleteCowImpl(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  await requirePermission("herd", "DELETE");
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
  return runAction(() => deleteCowsImpl(_prev, formData));
}

async function deleteCowsImpl(_prev: BulkDeleteState, formData: FormData): Promise<BulkDeleteState> {
  await requirePermission("herd", "DELETE");
  await requireAccess({ admin: true });

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
