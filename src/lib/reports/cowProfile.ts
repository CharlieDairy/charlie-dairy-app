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
    },
  });
  if (!cow) return null;

  const [milkAgg, recentMilking] = await Promise.all([
    prisma.milkingRecord.aggregate({
      where: { cowId: id },
      _sum: { litres: true },
      _count: { _all: true },
    }),
    prisma.milkingRecord.findMany({ where: { cowId: id }, orderBy: { date: "desc" }, take: 10 }),
  ]);

  const distinctDays = await prisma.$queryRaw<{ days: number | bigint }[]>`
    SELECT COUNT(DISTINCT date) as days FROM "MilkingRecord" WHERE "cowId" = ${id}
  `;
  const daysRecorded = Number(distinctDays[0]?.days ?? 0);
  const totalLitres = milkAgg._sum.litres ?? 0;

  return {
    cow,
    milking: {
      totalLitres,
      recordCount: milkAgg._count._all,
      daysRecorded,
      avgPerDay: daysRecorded > 0 ? totalLitres / daysRecorded : 0,
      recent: recentMilking,
    },
  };
}

export type CowProfile = NonNullable<Awaited<ReturnType<typeof getCowProfile>>>;
