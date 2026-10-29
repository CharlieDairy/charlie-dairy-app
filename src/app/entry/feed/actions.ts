"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess, requirePermission, assertNotBackdated, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqEnum, reqId, reqNum, reqText, optNum, optText, DIRECTIONS } from "@/lib/validate";
import { revalidatePath } from "next/cache";
import { repostFeedCosts } from "@/lib/feedCosting";

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
  // Feed is costed first-in, first-out: a receipt must carry its purchase rate (that is the cost of that layer of stock),
  // and an issue takes its rate from the oldest stock still on hand, so a rate typed on an issue is not used.
  if (direction === "IN" && !(rate && rate > 0)) {
    throw new ValidationError("Enter the rate you paid per unit for this purchase. Feed is costed first-in, first-out, so each purchase needs its own rate.");
  }

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

  // One "used today" figure per feed per day: a second one would be added on top of the first. Only an Admin can add another.
  if (direction === "OUT" && user.role !== "ADMIN") {
    const sameDay = await prisma.feedTransaction.findFirst({ where: { date, feedType, direction: "OUT" }, select: { quantity: true } });
    if (sameDay) throw new ValidationError(`${feedType} already has ${sameDay.quantity} ${item.unit} used recorded for that date. Only an Admin can change or add to a saved entry.`);
  }

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

  const created = await prisma.feedTransaction.create({
    data: {
      date,
      feedType,
      direction,
      quantity,
      rate: direction === "IN" ? rate ?? undefined : undefined,
      notes,
      enteredBy: user.name,
    },
    select: { id: true },
  });
  // Every cost after this entry may change (a back-dated purchase re-prices later issues), so the feed is re-costed.
  await repostFeedCosts([feedType], user.name);

  refreshFeed();
  const warning =
    stockAfter !== null && stockAfter < 0
      ? ` Warning: recorded stock of ${feedType} is now ${stockAfter.toFixed(1)} ${item.unit} — a purchase may be missing.`
      : "";
  let costNote = "";
  if (direction === "OUT") {
    const row = await prisma.feedTransaction.findUnique({ where: { id: created.id }, select: { cost: true } });
    costNote = row?.cost != null ? ` Cost Rs ${row.cost.toLocaleString("en-PK", { maximumFractionDigits: 0 })} (first-in, first-out).` : " No cost yet: there is no purchase rate on record for this feed.";
  }
  return { success: true, message: `${feedType} ${direction === "IN" ? "received" : "issued"}: ${quantity} ${item.unit} saved.${costNote}${warning}` };
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
  const admin = await requireAccess({ admin: true });
  const id = reqId(formData, "id", "Feed entry");
  const date = reqDate(formData, "date", "Date");
  const requested = reqText(formData, "feedType", "Feed", { max: 100 });
  const direction = reqEnum(formData, "direction", "Direction", DIRECTIONS);
  const quantity = reqNum(formData, "quantity", "Quantity", { positive: true, max: 10_000_000 });
  const rate = optNum(formData, "rate", "Rate", { max: 1_000_000 });
  const notes = optText(formData, "notes", "Notes", { max: 300 });

  const existing = await prisma.feedTransaction.findUnique({ where: { id }, select: { id: true, feedType: true, direction: true, rate: true } });
  if (!existing) return { success: false, message: "That entry no longer exists. Refresh the page." };

  const item = await prisma.feedItem.findFirst({
    where: { name: { equals: requested, mode: "insensitive" } },
    select: { name: true },
  });
  if (!item) throw new ValidationError("Pick a feed from the list. New feeds are added in Feed Master.");

  // A receipt's rate is the cost of that layer of stock. An issue's cost is not typed: it is worked out first-in,
  // first-out, so an issue keeps whatever old rate it had (used only where a purchase has no rate) and cost is recalculated.
  const keepRate = direction === "OUT" ? (existing.direction === "OUT" ? existing.rate : null) : rate;
  await prisma.feedTransaction.update({
    where: { id },
    data: { date, feedType: item.name, direction, quantity, rate: keepRate, cost: null, notes },
  });
  await repostFeedCosts([existing.feedType, item.name], admin.name);
  refreshFeed();
  return { success: true, message: "Entry updated and feed costs recalculated." };
}

export async function deleteFeedTransaction(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => deleteFeedTransactionImpl(formData));
}

async function deleteFeedTransactionImpl(formData: FormData): Promise<FormState> {
  const admin = await requireAccess({ admin: true });
  const id = reqId(formData, "id", "Feed entry");
  const row = await prisma.feedTransaction.findUnique({ where: { id }, select: { id: true, feedType: true } });
  if (!row) return { success: false, message: "That entry no longer exists. Refresh the page." };
  await prisma.feedTransaction.delete({ where: { id } });
  await repostFeedCosts([row.feedType], admin.name);
  refreshFeed();
  return { success: true, message: "Entry deleted and feed costs recalculated." };
}

export async function deleteFeedTransactions(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => deleteFeedTransactionsImpl(formData));
}

async function deleteFeedTransactionsImpl(formData: FormData): Promise<FormState> {
  const admin = await requireAccess({ admin: true });
  const ids = (formData.getAll("entryIds") as string[]).filter((v) => typeof v === "string" && v.length > 0);
  if (ids.length === 0) return { success: false, message: "No entries selected." };
  const feeds = await prisma.feedTransaction.findMany({ where: { id: { in: ids } }, select: { feedType: true }, distinct: ["feedType"] });
  const { count } = await prisma.feedTransaction.deleteMany({ where: { id: { in: ids } } });
  await repostFeedCosts(feeds.map((f) => f.feedType), admin.name);
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
  const admin = await requireAccess({ admin: true });
  const feedType = reqText(formData, "feedType", "Feed", { max: 100 });
  const from = reqText(formData, "from", "From date", { max: 10 });
  const to = reqText(formData, "to", "To date", { max: 10 });
  if (!DAY_KEY.test(from) || !DAY_KEY.test(to)) throw new ValidationError("Dates must be YYYY-MM-DD.");
  const { count } = await prisma.feedTransaction.deleteMany({
    where: { feedType, date: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T00:00:00.000Z`) } },
  });
  await repostFeedCosts([feedType], admin.name);
  refreshFeed();
  return { success: true, message: `Deleted ${count} ${feedType} entr${count === 1 ? "y" : "ies"} from ${from} to ${to}.` };
}