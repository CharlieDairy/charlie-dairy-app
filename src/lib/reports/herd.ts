import { prisma } from "@/lib/prisma";

export type HerdRow = {
  cowId: string;
  tag: string;
  status: string;
  totalLitres: number;
  daysMilked: number;
  avgLitresPerDay: number;
  avgFatPct: number | null;
  avgSnfPct: number | null;
};


export type PeriodKey = "day" | "week" | "month" | "year" | "all";

// Monday-start week, matching the period picker already used on the main
// Dashboard (dashboardMetrics.ts periodBounds). "all" (the previous, only
// behaviour) passes no date filter through to the query at all.
export function periodRange(period: PeriodKey, referenceDate = new Date()): { start: Date; end: Date } | null {
  const now = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()));
  if (period === "day") {
    return { start: now, end: new Date(now.getTime() + 86_400_000) };
  }
  if (period === "week") {
    const start = new Date(now.getTime() - ((now.getUTCDay() + 6) % 7) * 86_400_000);
    return { start, end: new Date(start.getTime() + 7 * 86_400_000) };
  }
  if (period === "month") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { start, end };
  }
  if (period === "year") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
    return { start, end };
  }
  return null;
}

export async function getHerdSummary(period: PeriodKey = "all"): Promise<HerdRow[]> {
  const range = periodRange(period);

  const rows = range
    ? await prisma.$queryRaw<
        {
          cowId: string;
          tag: string;
          status: string;
          totalLitres: number | null;
          daysMilked: number | bigint;
          avgFatPct: number | null;
          avgSnfPct: number | null;
        }[]
      >`
        SELECT c.id as "cowId", c.tag as tag, c.status as status,
               CAST(COALESCE(SUM(m.litres), 0) AS REAL) as "totalLitres",
               CAST(COUNT(DISTINCT m.date) AS REAL) as "daysMilked",
               CAST(AVG(m."fatPct") AS REAL) as "avgFatPct",
               CAST(AVG(m."snfPct") AS REAL) as "avgSnfPct"
        FROM "Cow" c
        LEFT JOIN "MilkingRecord" m ON m."cowId" = c.id AND m.date >= ${range.start} AND m.date < ${range.end}
        GROUP BY c.id, c.tag, c.status
        ORDER BY CAST(c.tag AS INTEGER) ASC
      `
    : await prisma.$queryRaw<
        {
          cowId: string;
          tag: string;
          status: string;
          totalLitres: number | null;
          daysMilked: number | bigint;
          avgFatPct: number | null;
          avgSnfPct: number | null;
        }[]
      >`
        SELECT c.id as "cowId", c.tag as tag, c.status as status,
               CAST(COALESCE(SUM(m.litres), 0) AS REAL) as "totalLitres",
               CAST(COUNT(DISTINCT m.date) AS REAL) as "daysMilked",
               CAST(AVG(m."fatPct") AS REAL) as "avgFatPct",
               CAST(AVG(m."snfPct") AS REAL) as "avgSnfPct"
        FROM "Cow" c
        LEFT JOIN "MilkingRecord" m ON m."cowId" = c.id
        GROUP BY c.id, c.tag, c.status
        ORDER BY CAST(c.tag AS INTEGER) ASC
      `;

  return rows.map((r) => {
    const daysMilked = Number(r.daysMilked);
    const totalLitres = r.totalLitres ?? 0;
    return {
      cowId: r.cowId,
      tag: r.tag,
      status: r.status,
      totalLitres,
      daysMilked,
      avgLitresPerDay: daysMilked > 0 ? totalLitres / daysMilked : 0,
      avgFatPct: r.avgFatPct,
      avgSnfPct: r.avgSnfPct,
    };
  });
}
