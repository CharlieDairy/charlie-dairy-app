"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate } from "@/lib/validate";
import { AiUnavailableError } from "@/lib/watch/ai";
import { readSheetPhoto } from "@/lib/sheetPhotoAi";
import { buildSheetFill, type SheetContext } from "@/lib/sheetPhoto";

// Reads a photo of a paper Daily Record Sheet and returns a DRAFT for the sheet's boxes. It saves nothing: the person checks the
// highlighted boxes and presses Save, which goes through the normal rules (saved figures stay locked, no duplicates, stock rule).

export type PhotoState = {
  success: boolean;
  message: string;
  fills?: Record<string, string>;
  unmatched?: string[];
  /** the date written on the photo when it is not the sheet's date */
  photoDate?: string;
};

const TYPES = { "image/jpeg": "image/jpeg", "image/png": "image/png", "image/webp": "image/webp" } as const;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PER_DAY = 40; // photos read in 24 hours across the whole farm
const PHOTO_AUDIT = { entity: "DailySheet", action: "sheet_photo_read" } as const;

export async function readSheetFromPhoto(formData: FormData): Promise<PhotoState> {
  return runAction(() => readImpl(formData));
}

async function readImpl(formData: FormData): Promise<PhotoState> {
  const user = await requirePermission("milk", "CREATE");
  const date = reqDate(formData, "date", "Date");
  const dateKey = date.toISOString().slice(0, 10);

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) throw new ValidationError("Choose a photo of the sheet first.");
  const mediaType = TYPES[file.type as keyof typeof TYPES];
  if (!mediaType) throw new ValidationError("The photo must be a JPEG, PNG or WebP picture.");
  if (file.size > MAX_BYTES) throw new ValidationError("The photo is too big. Take it again or choose a smaller one.");

  const today = await prisma.auditLog.count({ where: { ...PHOTO_AUDIT, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
  if (today >= MAX_PER_DAY) throw new ValidationError(`The daily limit of ${MAX_PER_DAY} photo readings has been reached. Try again tomorrow, or type the sheet in.`);

  // The same animals, buyers and feeds the sheet itself shows.
  const [cows, customers, feeds] = await Promise.all([
    prisma.cow.findMany({ where: { OR: [{ status: "MILKING" }, { milkingRecords: { some: { date } } }] }, select: { id: true, tag: true } }),
    prisma.customer.findMany({ where: { active: true, agreedRate: { not: null } }, select: { id: true, name: true } }),
    prisma.feedItem.findMany({ where: { active: true }, select: { id: true, name: true } }),
  ]);
  const ctx: SheetContext = { cows, customers, feeds, canFeed: hasPermission(user, "feed", "CREATE") };

  let result;
  try {
    result = await readSheetPhoto({ mediaType, base64: Buffer.from(await file.arrayBuffer()).toString("base64") }, ctx, dateKey);
  } catch (e) {
    if (e instanceof AiUnavailableError) throw new ValidationError(e.message);
    throw e;
  }

  const photoDate = /^\d{4}-\d{2}-\d{2}$/.test(result.read.date) ? result.read.date : "";
  const filled = buildSheetFill(result.read, ctx);
  await prisma.auditLog
    .create({
      data: {
        userId: user.id,
        userName: user.name,
        ...PHOTO_AUDIT,
        entityId: dateKey,
        newValue: JSON.stringify({ sheet: dateKey, photoDate, boxes: Object.keys(filled.fills).length, inputTokens: result.inputTokens, outputTokens: result.outputTokens }),
      },
    })
    .catch(() => undefined);

  if (photoDate && photoDate !== dateKey) {
    return {
      success: false,
      photoDate,
      message: `The photo is dated ${photoDate}, but this sheet is for ${dateKey}. Nothing was filled. Open ${photoDate} and read the photo there.`,
    };
  }
  const count = Object.keys(filled.fills).length;
  if (count === 0) {
    return { success: false, unmatched: filled.unmatched, message: "No figures could be read from that photo. Take it again, flat and in good light, with the whole sheet in view." };
  }
  return {
    success: true,
    fills: filled.fills,
    unmatched: filled.unmatched,
    message: photoDate ? `Read ${count} figures from the photo.` : `Read ${count} figures. No date could be read on the photo, so check it is the right day.`,
  };
}
