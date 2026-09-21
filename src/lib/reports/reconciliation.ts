import { prisma } from "@/lib/prisma";

export type ReconciliationRow = {
  date: string;
  producedLitres: number;
  recordedSaleLitres: number;
  varianceLitres: number;
};

// MilkSale is only populated by entries logged going forward through the app
// (historical sale volumes weren't migrated — see the migration reconciliation
// report), so variance for historical dates will show as fully unaccounted
// for until sales start being logged day to day.
function toIsoDate(value: string | Date): string {
  return (value instanceof Date ? value : new Date(value)).toISOString().slice(0, 10);
}

export async function getProductionReconciliation(limit = 30): Promise<ReconciliationRow[]> {
  const production = await prisma.$queryRaw<{ date: string | Date; total: number }[]>`
    SELECT date, CAST(SUM(litres) AS REAL) as total FROM "MilkingRecord" GROUP BY date ORDER BY date DESC LIMIT ${limit}
  `;
  const sales = await prisma.$queryRaw<{ date: string | Date; total: number }[]>`
    SELECT date, CAST(SUM(litres) AS REAL) as total FROM "MilkSale" GROUP BY date
  `;
  const salesByDate = new Map(sales.map((s) => [toIsoDate(s.date), s.total]));

  return production
    .map((p) => {
      const date = toIsoDate(p.date);
      const recorded = salesByDate.get(date) ?? 0;
      return {
        date,
        producedLitres: p.total,
        recordedSaleLitres: recorded,
        varianceLitres: p.total - recorded,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
