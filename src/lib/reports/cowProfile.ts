import { prisma } from "@/lib/prisma";

export async function getCowProfile(id: string) {
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

  const [milkAgg, qualityAgg, recentMilking, customFieldDefs, customFieldValues] = await Promise.all([
    prisma.milkingRecord.aggregate({
      where: { cowId: id },
      _sum: { litres: true },
      _count: { _all: true },
    }),
    prisma.milkingRecord.aggregate({
      where: { cowId: id, fatPct: { not: null } },
      _avg: { fatPct: true, snfPct: true },
    }),
    prisma.milkingRecord.findMany({ where: { cowId: id }, orderBy: { date: "desc" }, take: 10 }),
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

  // Lactation curve: daily total litres (all shifts summed), most recent 180
  // days of recorded data -- a per-animal production trend the way Channab's
  // "lactation performance per animal" chart shows it.
  const lactationRows = await prisma.$queryRaw<{ date: Date; total: number }[]>`
    SELECT date, CAST(SUM(litres) AS REAL) as total
    FROM "MilkingRecord"
    WHERE "cowId" = ${id}
    GROUP BY date
    ORDER BY date DESC
    LIMIT 180
  `;
  const lactationSeries = lactationRows
    .map((r) => ({ date: r.date.toISOString().slice(0, 10), litres: r.total }))
    .reverse();

  return {
    cow,
    milking: {
      totalLitres,
      recordCount: milkAgg._count._all,
      daysRecorded,
      avgPerDay: daysRecorded > 0 ? totalLitres / daysRecorded : 0,
      recent: recentMilking,
      avgFatPct: qualityAgg._avg.fatPct,
      avgSnfPct: qualityAgg._avg.snfPct,
    },
    lactationSeries,
    customFields,
  };
}

export type CowProfile = NonNullable<Awaited<ReturnType<typeof getCowProfile>>>;
