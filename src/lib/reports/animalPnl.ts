import { prisma } from "@/lib/prisma";
import { classifyCash } from "@/lib/accounting/cashClass";
import { extractTags, extractSoldTags, extractMotherTags } from "./tagMatch";

// Profit and loss for ONE animal over a period, on the same cash basis as the farm P&L.
//
// What is recorded per animal: every milking, treatments, vaccinations, inseminations, calvings and calves.
// What is NOT recorded per animal: feed, labour and running costs. Those are shared, so each animal is charged a
// share by "animal-days" (a milking day counts 1, a dry or heifer day 0.6, a calf day 0.3). The cash book also
// names animals in free text ("Semen for Tag 56"); those entries are read and charged straight to that animal.

const DAY = 86_400_000;
export const WEIGHT_MILKING = 1;
export const WEIGHT_YOUNG = 0.3; // under 6 months
export const WEIGHT_OTHER = 0.6; // dry cows, heifers, bulls

export type Line = { label: string; amount: number; note?: string };
export type Entry = { date: string; category: string; remark: string; amount: number; sharedWith: number };
export type CalfRow = { tag: string | null; sex: string; born: string; outcome: string; where: "WITH US" | "SOLD" | "DEAD" | "NOT TRACKED"; saleAmount: number | null; bornInPeriod: boolean };

export type AnimalPnl = {
  cow: { id: string; tag: string; breed: string | null; gender: string; status: string; dob: string | null; lactation: number; notes: string | null };
  period: { from: string; to: string; days: number };
  daysInHerd: number;
  milk: { litres: number; milkingDays: number; avgPerMilkingDay: number; bestDay: { date: string; litres: number } | null; herdAvgPerMilkingDay: number; rate: number | null; value: number };
  calves: { total: number; girls: number; boys: number; unknownSex: number; withUs: number; unlinked: number; sold: number; died: number; bornInPeriod: number; rows: CalfRow[] };
  income: Line[];
  directCosts: Line[];
  allocatedCosts: (Line & { pool: number; sharePct: number })[];
  entries: { income: Entry[]; cost: Entry[]; memo: Entry[] };
  totals: { income: number; direct: number; allocated: number; cost: number; net: number; netPerDay: number | null; costPerLitre: number | null; marginPerLitre: number | null };
  allocation: { animalDays: number; herdAnimalDays: number; animalsInHerd: number };
  warnings: string[];
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const overlapDays = (aStart: number, aEndExcl: number, pStart: number, pEndExcl: number) => Math.max(0, Math.round((Math.min(aEndExcl, pEndExcl) - Math.max(aStart, pStart)) / DAY));

const POOLS: { key: "feed" | "labour" | "health" | "other"; label: string; test: (cat: string) => boolean }[] = [
  { key: "feed", label: "Feed (shared share)", test: (c) => /^(opex feed|feed supliment|feed supplement)/.test(c) },
  { key: "labour", label: "Labour and salaries (shared share)", test: (c) => /^(opex salaries|advance salary)/.test(c) },
  { key: "health", label: "Herd health and breeding, not tagged to an animal (shared share)", test: (c) => /^(a\.i|opex medical|vaccination)/.test(c) },
  { key: "other", label: "Other running costs (shared share)", test: () => true },
];

export async function getAnimalPnl(cowId: string, start: Date, endExclusive: Date): Promise<AnimalPnl | null> {
  const cow = await prisma.cow.findUnique({
    where: { id: cowId },
    include: {
      calvingsAsDam: { orderBy: { date: "asc" }, include: { calves: { include: { cow: { select: { id: true, tag: true, status: true } } } } } },
      treatments: { where: { date: { gte: start, lt: endExclusive } }, select: { cost: true, medicineName: true, date: true } },
      vaccinations: { where: { date: { gte: start, lt: endExclusive } }, select: { cost: true, vaccineName: true, date: true } },
      inseminations: { where: { date: { gte: start, lt: endExclusive } }, select: { cost: true, date: true } },
    },
  });
  if (!cow) return null;

  const pStart = start.getTime();
  const pEnd = endExclusive.getTime();
  const periodDays = Math.round((pEnd - pStart) / DAY);

  const [cows, herdMilk, lastMilk, ownDaily, rateAgg, cashPeriod, cashSales] = await Promise.all([
    prisma.cow.findMany({ select: { id: true, tag: true, status: true, dateOfBirth: true, purchaseDate: true } }),
    prisma.$queryRaw<{ cowId: string; d: number; l: number }[]>`SELECT "cowId", COUNT(DISTINCT date)::int AS d, COALESCE(SUM(litres), 0)::float AS l FROM "MilkingRecord" WHERE date >= ${start} AND date < ${endExclusive} AND "cowId" IS NOT NULL GROUP BY "cowId"`,
    prisma.$queryRaw<{ cowId: string; last: Date }[]>`SELECT "cowId", MAX(date) AS last FROM "MilkingRecord" WHERE "cowId" IS NOT NULL GROUP BY "cowId"`,
    prisma.$queryRaw<{ date: Date; l: number }[]>`SELECT date, SUM(litres)::float AS l FROM "MilkingRecord" WHERE "cowId" = ${cowId} AND date >= ${start} AND date < ${endExclusive} GROUP BY date ORDER BY date`,
    prisma.milkSale.aggregate({ where: { date: { gte: start, lt: endExclusive } }, _sum: { amount: true, litres: true } }),
    prisma.cashTransaction.findMany({ where: { date: { gte: start, lt: endExclusive } }, select: { id: true, date: true, category: true, amountIn: true, amountOut: true, remark: true, accountClass: true } }),
    prisma.cashTransaction.findMany({ where: { category: { startsWith: "Cash sale proceed for", mode: "insensitive" }, amountIn: { gt: 0 } }, select: { date: true, category: true, amountIn: true, amountOut: true, remark: true, accountClass: true } }),
  ]);

  const warnings: string[] = [];
  // Costs are only recorded from the first cash book entry on. Days before that carry no cost, so they are left out
  // of the share-out (otherwise an animal's old days would pull in a share of costs that were never recorded).
  const firstCash = (await prisma.cashTransaction.aggregate({ _min: { date: true } }))._min.date;
  const aStart = firstCash ? Math.max(pStart, firstCash.getTime()) : pStart;
  const allocStart = new Date(aStart);
  if (firstCash && pStart < firstCash.getTime()) warnings.push(`Costs are recorded from ${iso(firstCash)}. Before that date only milk and calves can be shown, and no shared costs are charged.`);
  const milkDaysInWindow = new Map(
    (await prisma.$queryRaw<{ cowId: string; d: number }[]>`SELECT "cowId", COUNT(DISTINCT date)::int AS d FROM "MilkingRecord" WHERE date >= ${allocStart} AND date < ${endExclusive} AND "cowId" IS NOT NULL GROUP BY "cowId"`).map((r) => [r.cowId, r.d])
  );
  const tagSet = new Set(cows.map((c) => c.tag.trim().toUpperCase()));
  const myTag = cow.tag.trim().toUpperCase();

  // ---- milk ----
  const litres = ownDaily.reduce((n, r) => n + r.l, 0);
  const milkingDays = ownDaily.length;
  const best = ownDaily.reduce<{ date: Date; l: number } | null>((b, r) => (!b || r.l > b.l ? r : b), null);
  const herdLitres = herdMilk.reduce((n, r) => n + r.l, 0);
  const herdDays = herdMilk.reduce((n, r) => n + r.d, 0);
  const rate = rateAgg._sum.litres && rateAgg._sum.litres > 0 ? (rateAgg._sum.amount ?? 0) / rateAgg._sum.litres : null;
  const milkValue = rate ? litres * rate : 0;
  if (litres > 0 && rate === null) warnings.push("No milk was sold in this period, so the milk could not be valued.");

  // ---- animal-days, for sharing the farm's common costs ----
  const lastMilkMap = new Map(lastMilk.map((r) => [r.cowId, new Date(r.last).getTime()]));
  const saleDateByTag = new Map<string, number>();
  for (const s of cashSales) {
    if (classifyCash(s) !== "LIVESTOCK_SALES") continue;
    for (const t of extractSoldTags(s.remark)) saleDateByTag.set(t, Math.max(saleDateByTag.get(t) ?? 0, s.date.getTime()));
  }
  const midAge = (dob: Date | null) => (dob ? ((aStart + pEnd) / 2 - dob.getTime()) / DAY : null);
  const dayInfo = (c: (typeof cows)[number]) => {
    const born = (c.dateOfBirth ?? c.purchaseDate)?.getTime() ?? Number.NEGATIVE_INFINITY;
    let exitExcl = Number.POSITIVE_INFINITY;
    if (c.status === "SOLD" || c.status === "DEAD") {
      const sale = saleDateByTag.get(c.tag.trim().toUpperCase());
      const lm = lastMilkMap.get(c.id);
      const exit = sale ?? lm;
      exitExcl = exit === undefined ? Number.NEGATIVE_INFINITY : exit + DAY;
    }
    const present = overlapDays(born, exitExcl, aStart, pEnd);
    const milking = Math.min(milkDaysInWindow.get(c.id) ?? 0, present || (milkDaysInWindow.get(c.id) ?? 0));
    const age = midAge(c.dateOfBirth);
    const wOther = age !== null && age < 180 ? WEIGHT_YOUNG : WEIGHT_OTHER;
    const weighted = milking * WEIGHT_MILKING + Math.max(0, present - milking) * wOther;
    return { present: Math.max(present, milking), weighted };
  };
  let herdWeighted = 0;
  let animalsInHerd = 0;
  let mine = { present: 0, weighted: 0 };
  for (const c of cows) {
    const d = dayInfo(c);
    herdWeighted += d.weighted;
    if (d.present > 0) animalsInHerd++;
    if (c.id === cow.id) mine = d;
  }
  if (!cow.dateOfBirth && !cow.purchaseDate) warnings.push("This animal has no date of birth or purchase date, so it is counted as in the herd for the whole period.");
  if (mine.present === 0 && (cow.status === "SOLD" || cow.status === "DEAD")) warnings.push("This animal left the herd before this period (or its exit date is not recorded), so no shared costs are charged to it.");

  // ---- cash entries: direct (names this animal) and shared pools ----
  const entries = { income: [] as Entry[], cost: [] as Entry[], memo: [] as Entry[] };
  const directBy = { breeding: 0, health: 0, other: 0 };
  const pools = { feed: 0, labour: 0, health: 0, other: 0 };
  const calfTags = new Map<string, number>(); // calf tag -> proceeds in period (for the offspring-sales line)
  const calfTagSet = new Set<string>();
  for (const k of cow.calvingsAsDam) for (const c of k.calves) { const t = (c.cow?.tag ?? c.tag)?.trim().toUpperCase(); if (t) calfTagSet.add(t); }

  let breedingCash = 0, healthCash = 0;
  let ownSale = 0, offspringSale = 0;
  for (const e of cashPeriod) {
    const cls = classifyCash(e);
    const sold = cls === "LIVESTOCK_SALES";
    const tags = (sold ? extractSoldTags(e.remark) : extractTags(e.remark)).filter((t) => tagSet.has(t));
    const forMe = tags.includes(myTag);
    const cat = (e.category ?? "").trim().toLowerCase();
    const row = (amount: number, shared: number): Entry => ({ date: iso(e.date), category: e.category, remark: (e.remark ?? "").replace(/\s+/g, " ").trim(), amount, sharedWith: shared });

    if (cls === "LIVESTOCK_SALES") {
      const n = Math.max(1, tags.length);
      const amt = (e.amountIn - e.amountOut) / n;
      if (forMe) { ownSale += amt; entries.income.push(row(amt, n)); }
      else if (extractMotherTags(e.remark).includes(myTag)) {
        // "Male calf (Tag 137) sale, Mother Tag 47": a calf of this animal that has no calving record
        const total = e.amountIn - e.amountOut;
        offspringSale += total;
        entries.income.push(row(total, 1));
      } else { const kids = tags.filter((t) => calfTagSet.has(t)); if (kids.length) { const a = ((e.amountIn - e.amountOut) / n) * kids.length; offspringSale += a; entries.income.push(row(a, n)); for (const t of kids) calfTags.set(t, (calfTags.get(t) ?? 0) + (e.amountIn - e.amountOut) / n); } }
      continue;
    }
    if (cls === "CAPEX") { if (forMe) entries.memo.push(row((e.amountOut - e.amountIn) / Math.max(1, tags.length), tags.length)); continue; }
    if (cls !== "OPEX") continue;

    const cost = e.amountOut - e.amountIn;
    if (tags.length) {
      if (!forMe) continue; // belongs to another animal
      const share = cost / tags.length;
      entries.cost.push(row(share, tags.length));
      if (/^a\.i/.test(cat)) { directBy.breeding += share; breedingCash += share; }
      else if (/^(opex medical|vaccination)/.test(cat)) { directBy.health += share; healthCash += share; }
      else directBy.other += share;
      continue;
    }
    const pool = POOLS.find((p) => p.test(cat))!;
    pools[pool.key] += cost;
  }

  // costs held in the animal's own records, counted only when the cash book has no tagged entry of that kind
  const recBreeding = cow.inseminations.reduce((n, r) => n + (r.cost ?? 0), 0);
  const recHealth = cow.treatments.reduce((n, r) => n + (r.cost ?? 0), 0) + cow.vaccinations.reduce((n, r) => n + (r.cost ?? 0), 0);
  const addBreeding = breedingCash > 0 ? 0 : recBreeding;
  const addHealth = healthCash > 0 ? 0 : recHealth;

  // ---- calves ----
  const rows: CalfRow[] = [];
  for (const k of cow.calvingsAsDam) {
    for (const c of k.calves) {
      const tag = c.cow?.tag ?? c.tag ?? null;
      const status = c.cow?.status;
      const where: CalfRow["where"] = c.outcome !== "ALIVE" || status === "DEAD" ? "DEAD" : status === "SOLD" ? "SOLD" : status ? "WITH US" : "NOT TRACKED";
      const sale = tag ? cashSales.filter((s) => classifyCash(s) === "LIVESTOCK_SALES" && extractSoldTags(s.remark).includes(tag.trim().toUpperCase())).reduce((n, s) => n + (s.amountIn - s.amountOut) / Math.max(1, extractSoldTags(s.remark).length), 0) : 0;
      rows.push({ tag, sex: c.sex, born: iso(k.date), outcome: c.outcome, where, saleAmount: where === "SOLD" && sale > 0 ? sale : null, bornInPeriod: k.date.getTime() >= pStart && k.date.getTime() < pEnd });
    }
  }
  const calves = {
    total: rows.length,
    girls: rows.filter((r) => r.sex === "FEMALE").length,
    boys: rows.filter((r) => r.sex === "MALE").length,
    unknownSex: rows.filter((r) => r.sex !== "FEMALE" && r.sex !== "MALE").length,
    withUs: rows.filter((r) => r.where === "WITH US").length,
    unlinked: rows.filter((r) => r.where === "NOT TRACKED").length,
    sold: rows.filter((r) => r.where === "SOLD").length,
    died: rows.filter((r) => r.where === "DEAD").length,
    bornInPeriod: rows.filter((r) => r.bornInPeriod).length,
    rows,
  };
  if (cow.gender === "FEMALE" && rows.length === 0 && (cow.lactationNumber > 0 || cow.lastCalvingDate)) warnings.push("This animal has calved before, but no calving is recorded in the app, so its calves are not listed. Record them under Breeding > Calving.");

  // ---- assemble ----
  const income: Line[] = [
    { label: "Milk produced, valued at the farm's average selling price", amount: milkValue, note: rate ? `${litres.toFixed(0)} L × Rs ${rate.toFixed(0)} per litre` : undefined },
    { label: "Sale of this animal", amount: ownSale },
    { label: "Sale of its calves", amount: offspringSale },
  ].filter((l, i) => i === 0 || l.amount !== 0);

  const directCosts: Line[] = [
    { label: "Breeding (semen, AI, vet fee)", amount: directBy.breeding + addBreeding, note: addBreeding ? "from the insemination records" : undefined },
    { label: "Health (medicines, vaccines, vet)", amount: directBy.health + addHealth, note: addHealth ? "from the treatment and vaccination records" : undefined },
    { label: "Other costs named to this animal in the cash book", amount: directBy.other },
  ];

  const share = herdWeighted > 0 ? mine.weighted / herdWeighted : 0;
  const allocatedCosts = POOLS.map((p) => ({ label: p.label, amount: pools[p.key] * share, pool: pools[p.key], sharePct: share * 100 }));

  const totalIncome = income.reduce((n, l) => n + l.amount, 0);
  const direct = directCosts.reduce((n, l) => n + l.amount, 0);
  const allocated = allocatedCosts.reduce((n, l) => n + l.amount, 0);
  const cost = direct + allocated;
  const net = totalIncome - cost;

  return {
    cow: { id: cow.id, tag: cow.tag, breed: cow.breed, gender: cow.gender, status: cow.status, dob: cow.dateOfBirth ? iso(cow.dateOfBirth) : null, lactation: cow.lactationNumber, notes: cow.notes },
    period: { from: iso(start), to: iso(new Date(pEnd - DAY)), days: periodDays },
    daysInHerd: mine.present,
    milk: {
      litres, milkingDays, avgPerMilkingDay: milkingDays ? litres / milkingDays : 0,
      bestDay: best ? { date: iso(new Date(best.date)), litres: best.l } : null,
      herdAvgPerMilkingDay: herdDays ? herdLitres / herdDays : 0, rate, value: milkValue,
    },
    calves, income, directCosts, allocatedCosts,
    entries,
    totals: {
      income: totalIncome, direct, allocated, cost, net,
      netPerDay: mine.present ? net / mine.present : null,
      costPerLitre: litres > 0 ? cost / litres : null,
      marginPerLitre: litres > 0 && rate ? rate - cost / litres : null,
    },
    allocation: { animalDays: mine.weighted, herdAnimalDays: herdWeighted, animalsInHerd },
    warnings,
  };
}
