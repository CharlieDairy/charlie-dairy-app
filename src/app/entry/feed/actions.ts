"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess, requirePermission, assertNotBackdated, runAction } from "@/lib/access";
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

// ---------------------------------------------------------------------------
// Admin-only corrections to feed history: edit one entry, delete one, delete a
// ticked selection, or delete everything for one feed in a date range. Every
// change is written to the Audit Log automatically.
// ---------------------------------------------------------------------------

function refreshFeed() {
  revalidatePath("/entry/feed");
  revalidatePath("/admin/reports/feed");
  revalidatePath("/admin");
}

export async function updateFeedTransaction(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => updateFeedTransactionImpl(formData));
}

async function updateFeedTransactionImpl(formData: FormData): Promise<FormState> {
  await requireAccess({ admin: true });
  const id = reqId(formData, "id", "Feed entry");
  const date = reqDate(formData, "date", "Date");
  const requested = reqText(formData, "feedType", "Feed", { max: 100 });
  const direction = reqEnum(formData, "direction", "Direction", DIRECTIONS);
  const quantity = reqNum(formData, "quantity", "Quantity", { positive: true, max: 10_000_000 });
  const rate = optNum(formData, "rate", "Rate", { max: 1_000_000 });
  const costEntered = optNum(formData, "cost", "Cost", { max: 10_000_000_000 });
  const notes = optText(formData, "notes", "Notes", { max: 300 });

  const existing = await prisma.feedTransaction.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { success: false, message: "That entry no longer exists. Refresh the page." };

  const item = await prisma.feedItem.findFirst({
    where: { name: { equals: requested, mode: "insensitive" } },
    select: { name: true },
  });
  if (!item) throw new ValidationError("Pick a feed from the list. New feeds are added in Feed Master.");

  // Only issues (OUT) carry a cost: the typed cost, else rate x quantity.
  const cost =
    direction === "OUT" ? (costEntered ?? (rate ? Math.round(rate * quantity * 100) / 100 : null)) : null;

  await prisma.feedTransaction.update({
    where: { id },
    data: { date, feedType: item.name, direction, quantity, rate, cost, notes },
  });
  refreshFeed();
  return { success: true, message: "Entry updated." };
}

export async function deleteFeedTransaction(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => deleteFeedTransactionImpl(formData));
}

async function deleteFeedTransactionImpl(formData: FormData): Promise<FormState> {
  await requireAccess({ admin: true });
  const id = reqId(formData, "id", "Feed entry");
  const row = await prisma.feedTransaction.findUnique({ where: { id }, select: { id: true } });
  if (!row) return { success: false, message: "That entry no longer exists. Refresh the page." };
  await prisma.feedTransaction.delete({ where: { id } });
  refreshFeed();
  return { success: true, message: "Entry deleted." };
}

export async function deleteFeedTransactions(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => deleteFeedTransactionsImpl(formData));
}

async function deleteFeedTransactionsImpl(formData: FormData): Promise<FormState> {
  await requireAccess({ admin: true });
  const ids = (formData.getAll("entryIds") as string[]).filter((v) => typeof v === "string" && v.length > 0);
  if (ids.length === 0) return { success: false, message: "No entries selected." };
  const { count } = await prisma.feedTransaction.deleteMany({ where: { id: { in: ids } } });
  refreshFeed();
  return { success: true, message: `Deleted ${count} entr${count === 1 ? "y" : "ies"}.` };
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

// "Delete all" = every entry of ONE feed between two dates (the feed and
// period currently on screen). Deliberately not "the whole table" in one
// click: the scope is always the feed + range the Admin is looking at.
export async function deleteAllFeedTransactions(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => deleteAllFeedTransactionsImpl(formData));
}

async function deleteAllFeedTransactionsImpl(formData: FormData): Promise<FormState> {
  await requireAccess({ admin: true });
  const feedType = reqText(formData, "feedType", "Feed", { max: 100 });
  const from = reqText(formData, "from", "From date", { max: 10 });
  const to = reqText(formData, "to", "To date", { max: 10 });
  if (!DAY_KEY.test(from) || !DAY_KEY.test(to)) throw new ValidationError("Dates must be YYYY-MM-DD.");
  const { count } = await prisma.feedTransaction.deleteMany({
    where: { feedType, date: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T00:00:00.000Z`) } },
  });
  refreshFeed();
  return { success: true, message: `Deleted ${count} ${feedType} entr${count === 1 ? "y" : "ies"} from ${from} to ${to}.` };
}