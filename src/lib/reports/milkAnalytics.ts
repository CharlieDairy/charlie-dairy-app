import { prisma } from "@/lib/prisma";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type MonthlyMilkPoint = { month: string; monthLabel: string; litres: number };

export async function getAvailableYears(): Promise<number[]> {
  const rows = await prisma.$queryRaw<{ year: number | bigint }[]>`
    SELECT DISTINCT CAST(strftime('%Y', date / 1000, 'unixepoch') AS INTEGER) as year
    FROM MilkingRecord
    ORDER BY year DESC
  `;
  const years = new Set(rows.map((r) => Number(r.year)));
  years.add(new Date().getFullYear());
  return Array.from(years).sort((a, b) => b - a);
}

export async function getMonthlyMilkTrend(year: number): Promise<MonthlyMilkPoint[]> {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const records = await prisma.milkingRecord.findMany({
    where: { date: { gte: start, lt: end } },
    select: { date: true, litres: true },
  });

  const totals = new Array(12).fill(0) as number[];
  for (const r of records) {
    totals[r.date.getMonth()] += r.litres;
  }

  return totals.map((litres, i) => ({
    month: `${year}-${String(i + 1).padStart(2, "0")}`,
    monthLabel: MONTH_LABELS[i],
    litres: Math.round(litres * 10) / 10,
  }));
}

export function getBestMonth(trend: MonthlyMilkPoint[]): MonthlyMilkPoint | null {
  const withData = trend.filter((t) => t.litres > 0);
  if (withData.length === 0) return null;
  return withData.reduce((best, t) => (t.litres > best.litres ? t : best), withData[0]);
}

export type ProducerRow = { cowId: string; tag: string; totalLitres: number; daysRecorded: number; avgPerDay: number };

export async function getTopLowProducers(year: number, limit = 5): Promise<{ top: ProducerRow[]; low: ProducerRow[] }> {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const rows = await prisma.$queryRaw<
    { cowId: string; tag: string; totalLitres: number; daysRecorded: number }[]
  >`
    SELECT c.id as cowId, c.tag as tag,
           CAST(SUM(m.litres) AS REAL) as totalLitres,
           CAST(COUNT(DISTINCT m.date) AS REAL) as daysRecorded
    FROM MilkingRecord m
    JOIN Cow c ON c.id = m.cowId
    WHERE m.date >= ${start} AND m.date < ${end} AND m.cowId IS NOT NULL
    GROUP BY c.id, c.tag
    HAVING COUNT(DISTINCT m.date) >= 5
  `;

  const withAvg: ProducerRow[] = rows.map((r) => ({
    cowId: r.cowId,
    tag: r.tag,
    totalLitres: Math.round(r.totalLitres * 10) / 10,
    daysRecorded: r.daysRecorded,
    avgPerDay: Math.round((r.totalLitres / r.daysRecorded) * 10) / 10,
  }));

  const sorted = [...withAvg].sort((a, b) => b.avgPerDay - a.avgPerDay);
  return {
    top: sorted.slice(0, limit),
    low: sorted.slice(-limit).reverse(),
  };
}

export type SalesSummary = {
  totalLitresSold: number;
  totalRsSold: number;
  customerCount: number;
  recordCount: number;
  recordsWithQuantity: number;
};

// "Unknown" buyer = backfilled from historical cash-ledger entries that never
// recorded who the buyer was (see scripts/deploy/backfill-milksale-from-cash.ts).
// Those still count toward litres/Rs sold (real recorded revenue) but not
// toward customerCount, since we genuinely don't know who they were.
export async function getSalesSummary(year: number): Promise<SalesSummary> {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const sales = await prisma.milkSale.findMany({
    where: { date: { gte: start, lt: end } },
    select: { litres: true, amount: true, buyer: true },
  });

  const identifiedBuyers = new Set(sales.filter((s) => s.buyer && s.buyer !== "Unknown").map((s) => s.buyer));

  return {
    totalLitresSold: Math.round(sales.reduce((sum, s) => sum + s.litres, 0) * 10) / 10,
    totalRsSold: Math.round(sales.reduce((sum, s) => sum + s.amount, 0)),
    customerCount: identifiedBuyers.size,
    recordCount: sales.length,
    recordsWithQuantity: sales.filter((s) => s.litres > 0).length,
  };
}

export type ProductionVsSoldPoint = { month: string; monthLabel: string; produced: number; sold: number; unaccounted: number };

export async function getProductionVsSold(year: number): Promise<ProductionVsSoldPoint[]> {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const [production, sales] = await Promise.all([
    prisma.milkingRecord.findMany({ where: { date: { gte: start, lt: end } }, select: { date: true, litres: true } }),
    prisma.milkSale.findMany({ where: { date: { gte: start, lt: end } }, select: { date: true, litres: true } }),
  ]);

  const produced = new Array(12).fill(0) as number[];
  for (const r of production) produced[r.date.getMonth()] += r.litres;

  const sold = new Array(12).fill(0) as number[];
  for (const s of sales) sold[s.date.getMonth()] += s.litres;

  return produced.map((p, i) => ({
    month: `${year}-${String(i + 1).padStart(2, "0")}`,
    monthLabel: MONTH_LABELS[i],
    produced: Math.round(p * 10) / 10,
    sold: Math.round(sold[i] * 10) / 10,
    unaccounted: Math.round((p - sold[i]) * 10) / 10,
  }));
}

export type HerdCompositionRow = { status: string; label: string; count: number };

export async function getHerdComposition(labelMap: Map<string, string>): Promise<HerdCompositionRow[]> {
  const grouped = await prisma.cow.groupBy({ by: ["status"], _count: { _all: true } });
  const order = ["MILKING", "DRY", "HEIFER", "CALF", "DORMANT", "SOLD", "DEAD"];
  return grouped
    .map((g) => ({ status: g.status, label: labelMap.get(g.status) ?? g.status, count: g._count._all }))
    .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
}
