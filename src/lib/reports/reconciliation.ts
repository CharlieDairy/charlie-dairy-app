import { prisma } from "@/lib/prisma";
import { periodRange, type PeriodKey } from "./herd";

export type ReconciliationRow = {
  date: string;
  producedLitres: number;
  calfUseLitres: number;
  farmUseLitres: number;
  employeeUseLitres: number;
  recordedSaleLitres: number;
  varianceLitres: number;
  notionalUseCost: number;
};

// MilkSale is only populated by entries logged going forward through the app
// (historical sale volumes weren't migrated -- see the migration reconciliation
// report), so variance for historical dates will show as fully unaccounted
// for until sales start being logged day to day.
function toIsoDate(value: string | Date): string {
  return (value instanceof Date ? value : new Date(value)).toISOString().slice(0, 10);
}

// Values internal (non-sale) milk use at the farm's own recent average sale
// rate, so "produced minus everything accounted for" resolves to a real
// notional cost figure instead of an unexplained gap -- no cash actually
// moves for calf/farm/employee use, so this never creates a CashTransaction.
async function getAvgSaleRate(): Promise<number> {
  const result = await prisma.milkSale.aggregate({ _avg: { rate: true } });
  return result._avg.rate ?? 0;
}

export async function getProductionReconciliation(period: PeriodKey = "all"): Promise<ReconciliationRow[]> {
  const range = periodRange(period);
  const dateFilter = range ? { gte: range.start, lt: range.end } : undefined;

  const [production, sales, usage, avgRate] = await Promise.all([
    dateFilter
      ? prisma.$queryRaw<{ date: string | Date; total: number }[]>`
          SELECT date, CAST(SUM(litres) AS REAL) as total FROM "MilkingRecord"
          WHERE date >= ${range!.start} AND date < ${range!.end}
          GROUP BY date ORDER BY date DESC
        `
      : prisma.$queryRaw<{ date: string | Date; total: number }[]>`
          SELECT date, CAST(SUM(litres) AS REAL) as total FROM "MilkingRecord" GROUP BY date ORDER BY date DESC LIMIT 60
        `,
    prisma.$queryRaw<{ date: string | Date; total: number }[]>`
      SELECT date, CAST(SUM(litres) AS REAL) as total FROM "MilkSale" GROUP BY date
    `,
    prisma.$queryRaw<{ date: string | Date; type: string; total: number }[]>`
      SELECT date, type, CAST(SUM(litres) AS REAL) as total FROM "MilkUsageRecord" GROUP BY date, type
    `,
    getAvgSaleRate(),
  ]);

  const salesByDate = new Map(sales.map((s) => [toIsoDate(s.date), s.total]));
  const calfUseByDate = new Map<string, number>();
  const farmUseByDate = new Map<string, number>();
  const employeeUseByDate = new Map<string, number>();
  for (const u of usage) {
    const key = toIsoDate(u.date);
    const map = u.type === "CALF_USE" ? calfUseByDate : u.type === "FARM_USE" ? farmUseByDate : employeeUseByDate;
    map.set(key, (map.get(key) ?? 0) + u.total);
  }

  return production
    .map((p) => {
      const date = toIsoDate(p.date);
      const recorded = salesByDate.get(date) ?? 0;
      const calfUse = calfUseByDate.get(date) ?? 0;
      const farmUse = farmUseByDate.get(date) ?? 0;
      const employeeUse = employeeUseByDate.get(date) ?? 0;
      return {
        date,
        producedLitres: p.total,
        calfUseLitres: calfUse,
        farmUseLitres: farmUse,
        employeeUseLitres: employeeUse,
        recordedSaleLitres: recorded,
        varianceLitres: p.total - calfUse - farmUse - employeeUse - recorded,
        notionalUseCost: (calfUse + farmUse + employeeUse) * avgRate,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

// Today's sellable balance so Milk Sale Entry can show "available to sell"
// as guidance -- informational only, not a hard cap on the sale form.
export async function getTodaysSellableBalance(referenceDate = new Date()): Promise<{ produced: number; calfUse: number; farmUse: number; employeeUse: number; sold: number; available: number }> {
  const dayKey = referenceDate.toISOString().slice(0, 10);
  const start = new Date(`${dayKey}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 86_400_000);

  const [produced, usage, sold] = await Promise.all([
    prisma.milkingRecord.aggregate({ where: { date: { gte: start, lt: end } }, _sum: { litres: true } }),
    prisma.milkUsageRecord.findMany({ where: { date: { gte: start, lt: end } }, select: { type: true, litres: true } }),
    prisma.milkSale.aggregate({ where: { date: { gte: start, lt: end } }, _sum: { litres: true } }),
  ]);

  const calfUse = usage.filter((u) => u.type === "CALF_USE").reduce((n, u) => n + u.litres, 0);
  const farmUse = usage.filter((u) => u.type === "FARM_USE").reduce((n, u) => n + u.litres, 0);
  const employeeUse = usage.filter((u) => u.type === "EMPLOYEE_USE").reduce((n, u) => n + u.litres, 0);
  const producedLitres = produced._sum.litres ?? 0;
  const soldLitres = sold._sum.litres ?? 0;

  return {
    produced: producedLitres,
    calfUse,
    farmUse,
    employeeUse,
    sold: soldLitres,
    available: producedLitres - calfUse - farmUse - employeeUse - soldLitres,
  };
}
