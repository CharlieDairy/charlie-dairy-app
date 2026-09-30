import { prisma } from "@/lib/prisma";
import { periodRange, type PeriodKey } from "@/lib/reports/herd";

// "all" has no natural cutoff for a per-day chart, so it falls back to the
// same lookback the fixed 180-day lactation curve always used.
const ALL_TIME_LOOKBACK_DAYS = 180;

export async function getCowProfile(id: string, period: PeriodKey = "month") {
  const cow = await prisma.cow.findUnique({
    where: { id },
    include: {
      calvingsAsDam: {
        orderBy: { date: "desc" },
        include: { calves: true, insemination: true },
      },
      calfRecord: {
        include: { calving: { include: { dam: { select: { id: true, tag: true } } } } },
      },
      heatEvents: { orderBy: { detectedAt: "desc" }, take: 10 },
      inseminations: { orderBy: { date: "desc" }, take: 10 },
      pregnancyChecks: { orderBy: { date: "desc" }, take: 10 },
      weightRecords: { orderBy: { date: "asc" } },
      movements: { orderBy: { date: "desc" } },
      vaccinations: { orderBy: { date: "desc" }, take: 10 },
      treatments: { orderBy: { date: "desc" }, take: 10 },
    },
  });
  if (!cow) return null;

  const [milkAgg, qualityAgg, customFieldDefs, customFieldValues] = await Promise.all([
    prisma.milkingRecord.aggregate({
      where: { cowId: id },
      _sum: { litres: true },
      _count: { _all: true },
    }),
    prisma.milkingRecord.aggregate({
      where: { cowId: id, fatPct: { not: null } },
      _avg: { fatPct: true, snfPct: true },
    }),
    prisma.cowCustomFieldDef.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.cowCustomFieldValue.findMany({ where: { cowId: id } }),
  ]);
  const valueMap = new Map(customFieldValues.map((v) => [v.fieldDefId, v.value]));
  const customFields = customFieldDefs.map((def) => ({ def, value: valueMap.get(def.id) ?? "" }));

  const distinctDays = await prisma.$queryRaw<{ days: number | bigint }[]>`
    SELECT COUNT(DISTINCT date) as days FROM "MilkingRecord" WHERE "cowId" = ${id}
  `;
  const daysRecorded = Number(distinctDays[0]?.days ?? 0);
  const totalLitres = milkAgg._sum.litres ?? 0;

  // Per-day, per-shift breakdown for the selected period -- feeds both the
  // stacked bar chart and the daily table (Morning/Afternoon/Evening + avg),
  // the way Channab's per-animal milking log shows a full day at a glance
  // instead of a flat list of the most recent shift entries.
  const range = periodRange(period) ?? {
    start: new Date(Date.now() - ALL_TIME_LOOKBACK_DAYS * 86_400_000),
    end: new Date(Date.now() + 86_400_000),
  };
  const shiftRows = await prisma.$queryRaw<{ date: Date; shift: string; litres: number }[]>`
    SELECT date, shift, CAST(litres AS REAL) as litres
    FROM "MilkingRecord"
    WHERE "cowId" = ${id} AND date >= ${range.start} AND date < ${range.end}
    ORDER BY date ASC
  `;
  const byDate = new Map<string, { morning: number | null; afternoon: number | null; evening: number | null }>();
  for (const r of shiftRows) {
    const key = r.date.toISOString().slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, { morning: null, afternoon: null, evening: null });
    const entry = byDate.get(key)!;
    if (r.shift === "MORNING") entry.morning = r.litres;
    else if (r.shift === "AFTERNOON") entry.afternoon = r.litres;
    else if (r.shift === "EVENING") entry.evening = r.litres;
  }
  const dailyBreakdown = Array.from(byDate.entries())
    .map(([date, shifts]) => {
      const recorded = [shifts.morning, shifts.afternoon, shifts.evening].filter((v): v is number => v != null);
      const total = recorded.reduce((sum, v) => sum + v, 0);
      return {
        date,
        morning: shifts.morning,
        afternoon: shifts.afternoon,
        evening: shifts.evening,
        total,
        avgPerShift: recorded.length > 0 ? total / recorded.length : 0,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    cow,
    milking: {
      totalLitres,
      recordCount: milkAgg._count._all,
      daysRecorded,
      avgPerDay: daysRecorded > 0 ? totalLitres / daysRecorded : 0,
      avgFatPct: qualityAgg._avg.fatPct,
      avgSnfPct: qualityAgg._avg.snfPct,
    },
    dailyBreakdown,
    customFields,
  };
}

export type CowProfile = NonNullable<Awaited<ReturnType<typeof getCowProfile>>>;
