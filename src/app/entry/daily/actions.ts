"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission, assertNotBackdated, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, optNum, optText } from "@/lib/validate";
import { planNumbers, type Saved } from "@/lib/dailySheet";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

// Field names on the sheet:  m_<cowId>_<M|A|E>  sale_<customerId>  use_<TYPE>  out_<feedItemId>  in_<feedItemId>  note
const SHIFT_BY_CODE = { M: "MORNING", A: "AFTERNOON", E: "EVENING" } as const;
const USE_TYPES = ["CALF_USE", "EMPLOYEE_USE", "FARM_USE"] as const;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

const round2 = (n: number) => Math.round(n * 100) / 100;

const lockedError = (what: string[]) =>
  new ValidationError(`Already saved for this day: ${what.join(", ")}. Only an Admin can change a saved figure. Nothing was saved. Refresh the page to see what is already there.`);

function group<T>(rows: T[], keyOf: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = keyOf(r);
    m.set(k, [...(m.get(k) ?? []), r]);
  }
  return m;
}

export async function saveDailySheet(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => saveImpl(formData));
}

async function saveImpl(fd: FormData): Promise<FormState> {
  const user = await requirePermission("milk", "CREATE");
  const date = reqDate(fd, "date", "Date");
  assertNotBackdated(date, user, "Date");
  // Anything already saved for the day is locked: only an Admin may change a saved figure.
  const isAdmin = user.role === "ADMIN";

  const names = [...fd.keys()];
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  const counts = { created: 0, changed: 0, same: 0 };
  const left: string[] = [];

  // ---- milk by cow and shift -------------------------------------------------------------------------------
  const milkWanted = new Map<string, number>();
  const cowIds = new Set<string>();
  for (const k of names) {
    const m = /^m_(.+)_([MAE])$/.exec(k);
    if (!m || !ID.test(m[1])) continue;
    const litres = optNum(fd, k, "Milk litres", { min: 0, max: 200 });
    if (litres === null) continue;
    milkWanted.set(`${m[1]}|${SHIFT_BY_CODE[m[2] as "M" | "A" | "E"]}`, litres);
    cowIds.add(m[1]);
  }
  if (milkWanted.size > 0) {
    const [cows, rows] = await Promise.all([
      prisma.cow.findMany({ where: { id: { in: [...cowIds] } }, select: { id: true, tag: true, status: true } }),
      prisma.milkingRecord.findMany({ where: { date, cowId: { in: [...cowIds] } }, select: { id: true, cowId: true, shift: true, litres: true } }),
    ]);
    const saved = new Map<string, Saved[]>();
    for (const [k, v] of group(rows, (r) => `${r.cowId}|${r.shift}`)) saved.set(k, v.map((r) => ({ id: r.id, value: r.litres })));
    const plan = planNumbers(saved, milkWanted);
    const tagOf = new Map(cows.map((c) => [c.id, c] as const));

    for (const key of plan.create) {
      const cow = tagOf.get(key.split("|")[0]);
      if (!cow) throw new ValidationError("One of the animals on the sheet was not found. Refresh the page.");
      if (cow.status === "SOLD" || cow.status === "DEAD") throw new ValidationError(`Cow ${cow.tag} is marked ${cow.status} and can't be milked.`);
    }
    if (plan.create.length > 0) {
      const shifts = [...new Set(plan.create.map((k) => k.split("|")[1]))] as ("MORNING" | "AFTERNOON" | "EVENING")[];
      const groupTotals = await prisma.milkingRecord.count({ where: { cowId: null, date, shift: { in: shifts } } });
      if (groupTotals > 0) {
        throw new ValidationError("A herd/group total already covers one of these shifts. Record the cows individually or as one group total, not both.");
      }
    }
    if (plan.update.length > 0 && !isAdmin) throw lockedError(plan.update.map((u) => `Tag ${tagOf.get(u.key.split("|")[0])?.tag ?? "?"} ${u.key.split("|")[1].toLowerCase()}`));
    for (const key of plan.create) {
      const [cowId, shift] = key.split("|");
      ops.push(prisma.milkingRecord.create({ data: { cowId, date, shift: shift as "MORNING", litres: milkWanted.get(key)!, enteredBy: user.name } }));
    }
    for (const u of plan.update) ops.push(prisma.milkingRecord.update({ where: { id: u.id }, data: { litres: u.value } }));
    counts.created += plan.create.length;
    counts.changed += plan.update.length;
    counts.same += plan.unchanged;
    for (const key of plan.ambiguous) left.push(`${tagOf.get(key.split("|")[0])?.tag ?? "?"} ${key.split("|")[1].toLowerCase()} milk`);
  }

  // ---- milk sold, by customer -------------------------------------------------------------------------------
  const saleWanted = new Map<string, number>();
  for (const k of names) {
    const m = /^sale_(.+)$/.exec(k);
    if (!m || !ID.test(m[1])) continue;
    const litres = optNum(fd, k, "Milk sold", { min: 0, max: 100_000 });
    if (litres !== null && litres > 0) saleWanted.set(m[1], litres);
  }
  if (saleWanted.size > 0) {
    const customers = await prisma.customer.findMany({ where: { id: { in: [...saleWanted.keys()] } }, select: { id: true, name: true, agreedRate: true, active: true } });
    const byId = new Map(customers.map((c) => [c.id, c] as const));
    for (const id of saleWanted.keys()) {
      const c = byId.get(id);
      if (!c || !c.active) throw new ValidationError("One of the customers on the sheet is no longer active. Refresh the page.");
      if (c.agreedRate === null) throw new ValidationError(`"${c.name}" has no agreed rate. Set it on the Customers page first.`);
    }
    const rows = await prisma.milkSale.findMany({ where: { date, buyer: { in: customers.map((c) => c.name) } } });
    const byName = new Map(customers.map((c) => [c.name.toLowerCase(), c.id] as const));
    const saved = new Map<string, Saved[]>();
    for (const [k, v] of group(rows, (r) => byName.get(r.buyer.toLowerCase()) ?? r.buyer)) saved.set(k, v.map((r) => ({ id: r.id, value: r.litres })));
    const plan = planNumbers(saved, saleWanted);
    if (plan.update.length > 0 && !isAdmin) throw lockedError(plan.update.map((u) => `${byId.get(u.key)?.name ?? "a customer"} sale`));
    for (const id of plan.create) {
      const c = byId.get(id)!;
      const litres = saleWanted.get(id)!;
      ops.push(prisma.milkSale.create({ data: { date, buyer: c.name, litres, rate: c.agreedRate!, amount: round2(c.agreedRate! * litres), enteredBy: user.name } }));
    }
    for (const u of plan.update) {
      const row = rows.find((r) => r.id === u.id)!;
      const rate = row.rate ?? byId.get(u.key)!.agreedRate!; // keep the rate the sale was made at
      ops.push(prisma.milkSale.update({ where: { id: u.id }, data: { litres: u.value, amount: round2(rate * u.value) } }));
    }
    counts.created += plan.create.length;
    counts.changed += plan.update.length;
    counts.same += plan.unchanged;
    for (const id of plan.ambiguous) left.push(`${byId.get(id)?.name ?? "a customer"} sale`);
  }

  // ---- milk used on the farm ---------------------------------------------------------------------------------
  const useWanted = new Map<string, number>();
  for (const t of USE_TYPES) {
    const litres = optNum(fd, `use_${t}`, "Milk used", { min: 0, max: 100_000 });
    if (litres !== null && litres > 0) useWanted.set(t, litres);
  }
  if (useWanted.size > 0) {
    const rows = await prisma.milkUsageRecord.findMany({ where: { date, type: { in: [...useWanted.keys()] as (typeof USE_TYPES)[number][] } } });
    const saved = new Map<string, Saved[]>();
    for (const [k, v] of group(rows, (r) => r.type)) saved.set(k, v.map((r) => ({ id: r.id, value: r.litres })));
    const plan = planNumbers(saved, useWanted);
    if (plan.update.length > 0 && !isAdmin) throw lockedError(plan.update.map((u) => `${u.key.replace("_USE", "").toLowerCase()} milk use`));
    for (const t of plan.create) ops.push(prisma.milkUsageRecord.create({ data: { date, type: t as (typeof USE_TYPES)[number], litres: useWanted.get(t)!, enteredBy: user.name } }));
    for (const u of plan.update) ops.push(prisma.milkUsageRecord.update({ where: { id: u.id }, data: { litres: u.value } }));
    counts.created += plan.create.length;
    counts.changed += plan.update.length;
    counts.same += plan.unchanged;
    for (const t of plan.ambiguous) left.push(`${t.replace("_USE", "").toLowerCase()} milk use`);
  }

  // ---- feed issued and received ------------------------------------------------------------------------------
  const feedWanted = new Map<string, number>(); // "<feedItemId>|OUT" or "<feedItemId>|IN"
  for (const k of names) {
    const m = /^(out|in)_(.+)$/.exec(k);
    if (!m || !ID.test(m[2])) continue;
    const q = optNum(fd, k, "Feed quantity", { min: 0, max: 10_000_000 });
    if (q !== null && q > 0) feedWanted.set(`${m[2]}|${m[1].toUpperCase()}`, q);
  }
  if (feedWanted.size > 0) {
    if (!hasPermission(user, "feed", "CREATE")) throw new ValidationError("Your account can't record feed. Clear the feed boxes or ask the Admin.");
    const itemIds = [...new Set([...feedWanted.keys()].map((k) => k.split("|")[0]))];
    const items = await prisma.feedItem.findMany({ where: { id: { in: itemIds }, active: true }, select: { id: true, name: true, unit: true } });
    const byId = new Map(items.map((i) => [i.id, i] as const));
    for (const id of itemIds) if (!byId.has(id)) throw new ValidationError("One of the feeds on the sheet is no longer active. Refresh the page.");
    const rows = await prisma.feedTransaction.findMany({ where: { date, feedType: { in: items.map((i) => i.name) } } });
    const idByName = new Map(items.map((i) => [i.name, i.id] as const));
    const saved = new Map<string, Saved[]>();
    for (const [k, v] of group(rows, (r) => `${idByName.get(r.feedType)}|${r.direction}`)) saved.set(k, v.map((r) => ({ id: r.id, value: r.quantity })));
    const plan = planNumbers(saved, feedWanted);
    if (plan.update.length > 0 && !isAdmin) {
      throw lockedError(plan.update.map((u) => `${byId.get(u.key.split("|")[0])?.name ?? "a feed"} ${u.key.endsWith("OUT") ? "used" : "received"}`));
    }
    for (const key of plan.create) {
      const [id, direction] = key.split("|") as [string, "IN" | "OUT"];
      const item = byId.get(id)!;
      const quantity = feedWanted.get(key)!;
      let rate: number | undefined;
      if (direction === "OUT") {
        // the issue is valued at the most recent rate used for this feed
        const last = await prisma.feedTransaction.findFirst({ where: { feedType: item.name, direction: "OUT", rate: { not: null } }, orderBy: { date: "desc" }, select: { rate: true } });
        rate = last?.rate ?? undefined;
      }
      ops.push(prisma.feedTransaction.create({ data: { date, feedType: item.name, direction, quantity, rate, cost: rate ? round2(rate * quantity) : undefined, enteredBy: user.name } }));
    }
    for (const u of plan.update) {
      const row = rows.find((r) => r.id === u.id)!;
      ops.push(prisma.feedTransaction.update({ where: { id: u.id }, data: { quantity: u.value, cost: row.rate && row.direction === "OUT" ? round2(row.rate * u.value) : undefined } }));
    }
    counts.created += plan.create.length;
    counts.changed += plan.update.length;
    counts.same += plan.unchanged;
    for (const key of plan.ambiguous) left.push(`${byId.get(key.split("|")[0])?.name ?? "a feed"} ${key.endsWith("OUT") ? "issue" : "receipt"}`);
  }

  // ---- the day's note ------------------------------------------------------------------------------------------
  const note = optText(fd, "note", "Note", { max: 1000 });
  if (note) {
    const savedNote = await prisma.dailyNote.findUnique({ where: { date }, select: { text: true } });
    if (savedNote && savedNote.text !== note && !isAdmin) throw lockedError(["the note"]);
    ops.push(prisma.dailyNote.upsert({ where: { date }, create: { date, text: note, enteredBy: user.name }, update: { text: note } }));
  }

  if (ops.length === 0 && counts.same === 0 && left.length === 0) {
    return { success: false, message: "Nothing to save. Type at least one number on the sheet." };
  }
  if (ops.length > 0) await prisma.$transaction(ops);

  for (const p of ["/entry/daily", "/entry/milking", "/entry/milk-sale", "/entry/feed", "/admin", "/admin/reports/herd", "/admin/reports/milk-sales", "/admin/reports/reconciliation", "/admin/reports/feed", "/admin/reports/balance-sheet", "/admin/reports/ar-aging", "/admin/reports/milk-analytics", "/admin/reports/animal-pnl", "/admin/customers"]) revalidatePath(p);

  const parts = [`${counts.created} added`, `${counts.changed} changed`, `${counts.same} already saved`];
  if (note) parts.push("note saved");
  const warn = left.length > 0 ? ` Left unchanged because the day already has more than one entry: ${left.join(", ")}. Fix those in the detailed forms.` : "";
  return { success: true, message: `Saved ${date.toISOString().slice(0, 10)}: ${parts.join(", ")}.${warn}` };
}
