import { prisma } from "@/lib/prisma";
import { calcDaysOpen } from "@/lib/breeding/rules";

export type BreedingKpis = {
  pregnantCount: number;
  dueNext30Days: number;
  dueNext60Days: number;
  openCowsCount: number;
  avgDaysOpen: number | null;
  conceptionRatePct: number | null;
  servicesPerConception: number | null;
};

export type BreedingRegisterRow = {
  cowId: string;
  tag: string;
  status: string;
  lastCalvingDate: Date | null;
  lactationNumber: number;
  latestInseminationDate: Date | null;
  serviceNumber: number | null;
  expectedCalving: Date | null;
  dryDate: Date | null;
  daysOpen: number | null;
};

export async function getBreedingKpis(): Promise<BreedingKpis> {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86_400_000);
  const in60 = new Date(now.getTime() + 60 * 86_400_000);

  const activeCows = await prisma.cow.findMany({
    where: { gender: "FEMALE", status: { notIn: ["SOLD", "DEAD"] } },
    select: { id: true, status: true, lastCalvingDate: true, expectedCalving: true },
  });

  const pregnant = activeCows.filter((c) => c.expectedCalving !== null);
  const dueNext30Days = pregnant.filter((c) => c.expectedCalving! <= in30).length;
  const dueNext60Days = pregnant.filter((c) => c.expectedCalving! <= in60).length;

  const openCows = activeCows.filter((c) => c.expectedCalving === null && c.lastCalvingDate !== null);
  const daysOpenValues = openCows
    .map((c) => calcDaysOpen(c.lastCalvingDate, null, now))
    .filter((v): v is number => v !== null);
  const avgDaysOpen = daysOpenValues.length > 0
    ? Math.round(daysOpenValues.reduce((a, b) => a + b, 0) / daysOpenValues.length)
    : null;

  const [pregnantChecks, openChecks] = await Promise.all([
    prisma.pregnancyCheck.count({ where: { result: "PREGNANT" } }),
    prisma.pregnancyCheck.count({ where: { result: "OPEN" } }),
  ]);
  const conceptionRatePct = pregnantChecks + openChecks > 0
    ? Math.round((pregnantChecks / (pregnantChecks + openChecks)) * 1000) / 10
    : null;

  const totalInseminations = await prisma.insemination.count();
  const servicesPerConception = pregnantChecks > 0
    ? Math.round((totalInseminations / pregnantChecks) * 100) / 100
    : null;

  return {
    pregnantCount: pregnant.length,
    dueNext30Days,
    dueNext60Days,
    openCowsCount: openCows.length,
    avgDaysOpen,
    conceptionRatePct,
    servicesPerConception,
  };
}

export async function getBreedingRegister(): Promise<BreedingRegisterRow[]> {
  const cows = await prisma.cow.findMany({
    where: { gender: "FEMALE", status: { notIn: ["SOLD", "DEAD"] } },
    include: {
      inseminations: { orderBy: { date: "desc" }, take: 1 },
    },
  });

  const rows: BreedingRegisterRow[] = cows.map((c) => {
    const latest = c.inseminations[0];
    return {
      cowId: c.id,
      tag: c.tag,
      status: c.status,
      lastCalvingDate: c.lastCalvingDate,
      lactationNumber: c.lactationNumber,
      latestInseminationDate: latest?.date ?? null,
      serviceNumber: latest?.serviceNumber ?? null,
      expectedCalving: c.expectedCalving,
      dryDate: c.dryDate,
      daysOpen: c.expectedCalving ? null : calcDaysOpen(c.lastCalvingDate, null),
    };
  });

  return rows.sort((a, b) => Number(a.tag) - Number(b.tag) || a.tag.localeCompare(b.tag));
}
