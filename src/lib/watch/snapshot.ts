import { prisma } from "@/lib/prisma";
import { NAV_SECTIONS } from "@/lib/nav";
import { makeContext, key } from "./types";

type MonthRow = { m: string; a: number | null; b: number | null };

/**
 * A compact, numbers-only picture of how complete and healthy the farm's
 * records are. This (plus the open findings) is all the AI review sees:
 * counts, date ranges and monthly totals, never free-text remarks.
 */
export async function buildCoverage() {
  const { today } = makeContext();
  const back13 = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 12, 1));

  const [milk, sales, usage, cash, feed, capital, assets] = await Promise.all([
    prisma.milkingRecord.aggregate({ _count: { _all: true }, _min: { date: true }, _max: { date: true } }),
    prisma.milkSale.aggregate({ _count: { _all: true }, _min: { date: true }, _max: { date: true } }),
    prisma.milkUsageRecord.aggregate({ _count: { _all: true }, _min: { date: true }, _max: { date: true } }),
    prisma.cashTransaction.aggregate({ _count: { _all: true }, _min: { date: true }, _max: { date: true } }),
    prisma.feedTransaction.aggregate({ _count: { _all: true }, _min: { date: true }, _max: { date: true } }),
    prisma.capitalEntry.aggregate({ _count: { _all: true }, _min: { date: true }, _max: { date: true } }),
    prisma.asset.aggregate({ _count: { _all: true }, _sum: { currentValue: true } }),
  ]);

  const [mMilk, mSales, mUse, mCash, mFeed] = await Promise.all([
    prisma.$queryRaw<MonthRow[]>`SELECT to_char(date,'YYYY-MM') m, SUM(litres)::float a, NULL::float b FROM "MilkingRecord" WHERE date >= ${back13} GROUP BY 1`,
    prisma.$queryRaw<MonthRow[]>`SELECT to_char(date,'YYYY-MM') m, SUM(litres)::float a, SUM(amount)::float b FROM "MilkSale" WHERE date >= ${back13} GROUP BY 1`,
    prisma.$queryRaw<MonthRow[]>`SELECT to_char(date,'YYYY-MM') m, SUM(litres)::float a, NULL::float b FROM "MilkUsageRecord" WHERE date >= ${back13} GROUP BY 1`,
    prisma.$queryRaw<MonthRow[]>`SELECT to_char(date,'YYYY-MM') m, SUM("amountIn")::float a, SUM("amountOut")::float b FROM "CashTransaction" WHERE date >= ${back13} GROUP BY 1`,
    prisma.$queryRaw<MonthRow[]>`SELECT to_char(date,'YYYY-MM') m, SUM(CASE WHEN direction='OUT' THEN quantity ELSE 0 END)::float a, SUM(COALESCE(cost,0))::float b FROM "FeedTransaction" WHERE date >= ${back13} GROUP BY 1`,
  ]);

  const months = new Set<string>([...mMilk, ...mSales, ...mUse, ...mCash, ...mFeed].map((r) => r.m));
  const pick = (rows: MonthRow[], m: string) => rows.find((r) => r.m === m);
  const monthly = [...months].sort().map((m) => {
    const produced = pick(mMilk, m)?.a ?? 0;
    const sold = pick(mSales, m)?.a ?? 0;
    const used = pick(mUse, m)?.a ?? 0;
    return {
      month: m,
      litresProduced: Math.round(produced),
      litresSold: Math.round(sold),
      litresUsedOnFarm: Math.round(used),
      unaccountedPct: produced > 0 ? Math.round(((produced - sold - used) / produced) * 1000) / 10 : null,
      milkSalesRs: Math.round(pick(mSales, m)?.b ?? 0),
      cashInRs: Math.round(pick(mCash, m)?.a ?? 0),
      cashOutRs: Math.round(pick(mCash, m)?.b ?? 0),
      feedIssuedKg: Math.round(pick(mFeed, m)?.a ?? 0),
      feedCostRs: Math.round(pick(mFeed, m)?.b ?? 0),
    };
  });

  const [cows, customers, employees, vendors, users, healthRecs, breedingRecs, weights] = await Promise.all([
    prisma.cow.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.customer.count({ where: { active: true } }),
    prisma.employee.count({ where: { active: true } }),
    prisma.vendor.count(),
    prisma.user.groupBy({ by: ["role"], where: { active: true }, _count: { _all: true } }),
    prisma.vaccinationRecord.count().then(async (v) => v + (await prisma.treatmentRecord.count())),
    prisma.insemination.count().then(async (v) => v + (await prisma.calving.count()) + (await prisma.pregnancyCheck.count())),
    prisma.weightRecord.count(),
  ]);

  const range = (a: { _count: { _all: number }; _min: { date: Date | null }; _max: { date: Date | null } }) => ({
    rows: a._count._all,
    from: a._min.date ? key(a._min.date) : null,
    to: a._max.date ? key(a._max.date) : null,
  });

  return {
    asOf: key(today),
    records: {
      milking: range(milk),
      milkSales: range(sales),
      milkUse: range(usage),
      cash: range(cash),
      feed: range(feed),
      capital: range(capital),
      assets: { rows: assets._count._all, currentValueRs: Math.round(assets._sum.currentValue ?? 0) },
      healthRecords: healthRecs,
      breedingRecords: breedingRecs,
      weightRecords: weights,
    },
    herd: Object.fromEntries(cows.map((c) => [c.status, c._count._all])),
    setUp: { activeCustomers: customers, activeEmployees: employees, vendors, activeUsersByRole: Object.fromEntries(users.map((u) => [u.role, u._count._all])) },
    monthly,
  };
}

/** What the app has, by menu section, so the AI can say what is missing without guessing. */
export function capabilityMap(): string {
  return NAV_SECTIONS.map((s) => `${s.label}: ${s.items.map((i) => i.label).join(", ")}`).join("\n");
}
