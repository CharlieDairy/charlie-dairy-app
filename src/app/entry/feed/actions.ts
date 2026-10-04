"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, assertNotBackdated, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqEnum, reqId, reqNum, reqText, optNum, optText, DIRECTIONS } from "@/lib/validate";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

export async function submitFeed(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => submitFeedImpl(formData));
}

async function submitFeedImpl(formData: FormData): Promise<FormState> {
  const user = await requirePermission("feed", "CREATE");

  const date = reqDate(formData, "date", "Date");
  assertNotBackdated(date, user, "Date");
  const requested = reqText(formData, "feedType", "Feed", { max: 100 });
  const direction = reqEnum(formData, "direction", "Direction", DIRECTIONS); // "IN" | "OUT"
  const quantity = reqNum(formData, "quantity", "Quantity", { positive: true, max: 10_000_000 });
  const rate = optNum(formData, "rate", "Rate", { max: 1_000_000 });
  const notes = optText(formData, "notes", "Notes", { max: 300 });

  // The feed must be one defined in Feed Master (matched ignoring case, saved
  // with the master's spelling) so every entry lands on a real feed item.
  const item = await prisma.feedItem.findFirst({
    where: { name: { equals: requested, mode: "insensitive" }, active: true },
    select: { name: true, unit: true },
  });
  if (!item) {
    throw new ValidationError("Pick a feed from the list. New feeds are added in Feed Master.");
  }
  const feedType = item.name;

  const duplicate = await prisma.feedTransaction.findFirst({
    where: { date, feedType, direction, quantity, createdAt: { gte: new Date(Date.now() - 120_000) } },
    select: { id: true },
  });
  if (duplicate) {
    throw new ValidationError("This looks identical to an entry saved moments ago, so it wasn't saved twice.");
  }

  // Recorded stock for this feed before this entry, to warn (not block --
  // older stock may simply never have been entered) when an OUT overdraws it.
  let stockAfter: number | null = null;
  if (direction === "OUT") {
    const [inAgg, outAgg] = await Promise.all([
      prisma.feedTransaction.aggregate({ _sum: { quantity: true }, where: { feedType, direction: "IN" } }),
      prisma.feedTransaction.aggregate({ _sum: { quantity: true }, where: { feedType, direction: "OUT" } }),
    ]);
    stockAfter = (inAgg._sum.quantity ?? 0) - (outAgg._sum.quantity ?? 0) - quantity;
  }

  await prisma.feedTransaction.create({
    data: {
      date,
      feedType,
      direction,
      quantity,
      rate: rate ?? undefined,
      cost: rate && direction === "OUT" ? Math.round(rate * quantity * 100) / 100 : undefined,
      notes,
      enteredBy: user.name,
    },
  });

  revalidatePath("/entry/feed");
  revalidatePath("/admin/reports/feed");
  const warning =
    stockAfter !== null && stockAfter < 0
      ? ` Warning: recorded stock of ${feedType} is now ${stockAfter.toFixed(1)} ${item.unit} — a purchase may be missing.`
      : "";
  return { success: true, message: `${feedType} ${direction === "IN" ? "received" : "issued"}: ${quantity} ${item.unit} saved.${warning}` };
}

export async function deleteFeedTransaction(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => deleteFeedTransactionImpl(formData));
}

async function deleteFeedTransactionImpl(formData: FormData): Promise<FormState> {
  await requirePermission("feed", "DELETE");
  const id = reqId(formData, "id", "Feed entry");
  const row = await prisma.feedTransaction.findUnique({ where: { id }, select: { id: true } });
  if (!row) return { success: false, message: "That entry no longer exists. Refresh the page." };
  await prisma.feedTransaction.delete({ where: { id } });
  revalidatePath("/entry/feed");
  revalidatePath("/admin/reports/feed");
  return { success: true, message: "Entry deleted." };
}
