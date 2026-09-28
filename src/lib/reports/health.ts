import { prisma } from "@/lib/prisma";
import { compare, monthRanges, type Comparison } from "@/lib/compare";

export type HealthOverview = {
  vaccinationsThisMonth: Comparison;
  treatmentsThisMonth: Comparison;
  healthCostThisMonth: Comparison;
  dueSoonCount: number;
};

export async function getHealthOverview(referenceDate = new Date()): Promise<HealthOverview> {
  const { currentStart, nextStart, previousStart } = monthRanges(referenceDate);
  const in30 = new Date(referenceDate.getTime() + 30 * 86_400_000);

  const [
    vaxCurrent, vaxPrevious, txCurrent, txPrevious,
    vaxCostCurrent, vaxCostPrevious, txCostCurrent, txCostPrevious,
    dueSoonCount,
  ] = await Promise.all([
    prisma.vaccinationRecord.count({ where: { date: { gte: currentStart, lt: nextStart } } }),
    prisma.vaccinationRecord.count({ where: { date: { gte: previousStart, lt: currentStart } } }),
    prisma.treatmentRecord.count({ where: { date: { gte: currentStart, lt: nextStart } } }),
    prisma.treatmentRecord.count({ where: { date: { gte: previousStart, lt: currentStart } } }),
    prisma.vaccinationRecord.aggregate({ where: { date: { gte: currentStart, lt: nextStart } }, _sum: { cost: true } }),
    prisma.vaccinationRecord.aggregate({ where: { date: { gte: previousStart, lt: currentStart } }, _sum: { cost: true } }),
    prisma.treatmentRecord.aggregate({ where: { date: { gte: currentStart, lt: nextStart } }, _sum: { cost: true } }),
    prisma.treatmentRecord.aggregate({ where: { date: { gte: previousStart, lt: currentStart } }, _sum: { cost: true } }),
    prisma.vaccinationRecord.count({ where: { nextDueDate: { lte: in30, gte: referenceDate } } }),
  ]);

  const costCurrent = (vaxCostCurrent._sum.cost ?? 0) + (txCostCurrent._sum.cost ?? 0);
  const costPrevious = (vaxCostPrevious._sum.cost ?? 0) + (txCostPrevious._sum.cost ?? 0);

  return {
    vaccinationsThisMonth: compare(vaxCurrent, vaxPrevious),
    treatmentsThisMonth: compare(txCurrent, txPrevious),
    healthCostThisMonth: compare(costCurrent, costPrevious),
    dueSoonCount,
  };
}

export type UpcomingVaccination = {
  id: string;
  cowId: string;
  cowTag: string;
  vaccineName: string;
  nextDueDate: Date;
  overdue: boolean;
};

export async function getUpcomingVaccinations(referenceDate = new Date(), withinDays = 30): Promise<UpcomingVaccination[]> {
  const horizon = new Date(referenceDate.getTime() + withinDays * 86_400_000);
  const rows = await prisma.vaccinationRecord.findMany({
    where: { nextDueDate: { lte: horizon } },
    include: { cow: { select: { id: true, tag: true } } },
    orderBy: { nextDueDate: "asc" },
    take: 50,
  });

  return rows
    .filter((r) => r.nextDueDate !== null)
    .map((r) => ({
      id: r.id,
      cowId: r.cow.id,
      cowTag: r.cow.tag,
      vaccineName: r.vaccineName,
      nextDueDate: r.nextDueDate!,
      overdue: r.nextDueDate! < referenceDate,
    }));
}

export type RecentHealthEvent = {
  id: string;
  cowTag: string;
  kind: "Vaccination" | "Treatment";
  label: string;
  date: Date;
  cost: number | null;
};

export async function getRecentHealthEvents(limit = 20): Promise<RecentHealthEvent[]> {
  const [vax, tx] = await Promise.all([
    prisma.vaccinationRecord.findMany({
      include: { cow: { select: { tag: true } } },
      orderBy: { date: "desc" },
      take: limit,
    }),
    prisma.treatmentRecord.findMany({
      include: { cow: { select: { tag: true } } },
      orderBy: { date: "desc" },
      take: limit,
    }),
  ]);

  const events: RecentHealthEvent[] = [
    ...vax.map((v) => ({ id: v.id, cowTag: v.cow.tag, kind: "Vaccination" as const, label: v.vaccineName, date: v.date, cost: v.cost })),
    ...tx.map((t) => ({ id: t.id, cowTag: t.cow.tag, kind: "Treatment" as const, label: t.medicineName, date: t.date, cost: t.cost })),
  ];

  return events.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit);
}
