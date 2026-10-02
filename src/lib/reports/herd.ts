import { prisma } from "@/lib/prisma";
import type { PeriodKey } from "@/lib/periodOptions";

export type { PeriodKey };

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

const DAY_MS = 86_400_000;

function dayBounds(key: string): { start: Date; end: Date } {
  const start = new Date(`${key}T00:00:00.000Z`);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

function validDayKey(value: string | undefined, fallback: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value ? value : fallback;
}

// The one standard period control for the whole app (src/lib/periodOptions.ts
// PERIOD_OPTIONS, src/components/PeriodBar.tsx), ported from the admin
// Dashboard's own period picker (dashboardMetrics.ts periodBounds, which
// this was generalized from -- same math, so "This month" etc. mean
// exactly the same date range on every page). Monday-start week. Every
// preset except "last-month"/"last-year" is "to date", not a full future-
// reaching calendar period -- "This month" ends at today, not at the end
// of the month, so it never implies data that hasn't happened yet.
export function periodRange(period: PeriodKey, referenceDate = new Date(), from?: string, to?: string): { start: Date; end: Date } {
  const todayKey = referenceDate.toISOString().slice(0, 10);
  const now = dayBounds(todayKey).start;
  let start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  let end = dayBounds(todayKey).end;
  if (period === "day") start = now;
  if (period === "week") start = new Date(now.getTime() - ((now.getUTCDay() + 6) % 7) * DAY_MS);
  if (period === "last-month") {
    end = start;
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  }
  if (period === "quarter") start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  if (period === "year") start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  if (period === "last-year") {
    start = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
    end = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  }
  if (period === "custom") {
    start = dayBounds(validDayKey(from, todayKey)).start;
    end = dayBounds(validDayKey(to, todayKey)).end;
    if (end <= start) end = new Date(start.getTime() + DAY_MS);
  }
  return { start, end };
}

export async function getHerdSummary(period: PeriodKey = "month", from?: string, to?: string): Promise<HerdRow[]> {
  const range = periodRange(period, new Date(), from, to);

  const rows = await prisma.$queryRaw<
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
  `;

  return rows
    .map((r) => {
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
    })
    // A raw `CAST(tag AS INTEGER)` ORDER BY (the previous approach) throws a
    // Postgres error the moment any tag isn't purely numeric (e.g. "PK-001")
    // -- sort in JS instead, same numeric-first-then-text fallback used
    // everywhere else in the app a cow tag is sorted (e.g. admin/cows/page.tsx).
    .sort((a, b) => Number(a.tag) - Number(b.tag) || a.tag.localeCompare(b.tag));
}
