import { prisma } from "@/lib/prisma";
import { getMonthlyPnl } from "./pnl";

const BACKFILL_MARKER = "Backfill (cash ledger)";

export type DashboardSummary = {
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
  netMargin: number;
  closingCash: number;
  activeHerdSize: number;
  totalMilkLitres: number;
  capitalRaised: number;
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const monthly = await getMonthlyPnl();
  const totalRevenue = monthly.reduce((s, m) => s + m.revenue, 0);
  const totalExpense = monthly.reduce((s, m) => s + m.expense, 0);
  const netIncome = totalRevenue - totalExpense;

  const [activeHerdSize, milkAgg, capitalAgg] = await Promise.all([
    prisma.cow.count({ where: { status: { in: ["MILKING", "DRY", "HEIFER", "CALF"] } } }),
    prisma.milkingRecord.aggregate({ _sum: { litres: true } }),
    prisma.capitalEntry.aggregate({ _sum: { credit: true, debit: true } }),
  ]);

  return {
    totalRevenue,
    totalExpense,
    netIncome,
    netMargin: totalRevenue > 0 ? netIncome / totalRevenue : 0,
    closingCash: netIncome, // cash-basis: net of all recorded cash in/out to date
    activeHerdSize,
    totalMilkLitres: milkAgg._sum.litres ?? 0,
    capitalRaised: (capitalAgg._sum.credit ?? 0) - (capitalAgg._sum.debit ?? 0),
  };
}

export type TodaySnapshot = {
  /** ISO date actually shown — today if it has data, otherwise the most recent date that does. */
  date: string;
  isToday: boolean;
  milkLitres: number;
  milkingCowCount: number;
  milkPerCow: number;
  revenue: number;
  expense: number;
  estimatedMargin: number;
};

function dayBounds(d: Date): { start: Date; end: Date } {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// Falls back to the most recent date with a milking record rather than
// silently showing zero for "today" — this farm's data entry may lag real
// time (e.g. a dev/demo dataset, or a farm that batches entry), and a "Milk
// Today: 0 L" card would misleadingly read as "no milk produced" rather
// than "no entry yet for today." isToday tells the UI which framing to use.
export async function getTodaySnapshot(): Promise<TodaySnapshot> {
  let { start, end } = dayBounds(new Date());
  let isToday = true;

  const todayMilk = await prisma.milkingRecord.aggregate({ where: { date: { gte: start, lt: end } }, _sum: { litres: true } });
  if (!todayMilk._sum.litres) {
    const latest = await prisma.milkingRecord.findFirst({ orderBy: { date: "desc" }, select: { date: true } });
    if (latest) {
      ({ start, end } = dayBounds(latest.date));
      isToday = false;
    }
  }

  const [milkAgg, milkingCowCount, cash, sales] = await Promise.all([
    prisma.milkingRecord.aggregate({ where: { date: { gte: start, lt: end } }, _sum: { litres: true } }),
    prisma.cow.count({ where: { status: "MILKING" } }),
    prisma.cashTransaction.aggregate({ where: { date: { gte: start, lt: end } }, _sum: { amountIn: true, amountOut: true } }),
    prisma.milkSale.aggregate({
      where: { date: { gte: start, lt: end }, NOT: { enteredBy: BACKFILL_MARKER } },
      _sum: { amount: true },
    }),
  ]);

  const milkLitres = milkAgg._sum.litres ?? 0;
  const revenue = (cash._sum.amountIn ?? 0) + (sales._sum.amount ?? 0);
  const expense = cash._sum.amountOut ?? 0;

  return {
    date: start.toISOString().slice(0, 10),
    isToday,
    milkLitres,
    milkingCowCount,
    milkPerCow: milkingCowCount > 0 ? milkLitres / milkingCowCount : 0,
    revenue,
    expense,
    estimatedMargin: revenue - expense,
  };
}
