import { prisma } from "@/lib/prisma";
import { compare, monthRanges, type Comparison } from "@/lib/compare";

export type WeightOverview = {
  recordsThisMonth: Comparison;
  animalsWeighedThisMonth: number;
  activeHerdSize: number;
};

export async function getWeightOverview(referenceDate = new Date()): Promise<WeightOverview> {
  const { currentStart, nextStart, previousStart } = monthRanges(referenceDate);

  const [currentCount, previousCount, distinctThisMonth, activeHerdSize] = await Promise.all([
    prisma.weightRecord.count({ where: { date: { gte: currentStart, lt: nextStart } } }),
    prisma.weightRecord.count({ where: { date: { gte: previousStart, lt: currentStart } } }),
    prisma.weightRecord.findMany({ where: { date: { gte: currentStart, lt: nextStart } }, select: { cowId: true }, distinct: ["cowId"] }),
    prisma.cow.count({ where: { status: { in: ["MILKING", "DRY", "HEIFER", "CALF"] } } }),
  ]);

  return {
    recordsThisMonth: compare(currentCount, previousCount),
    animalsWeighedThisMonth: distinctThisMonth.length,
    activeHerdSize,
  };
}

export type WeightStatusRow = {
  cowId: string;
  tag: string;
  breed: string | null;
  ageMonths: number | null;
  latestWeightKg: number | null;
  latestWeightDate: Date | null;
  standardMin: number | null;
  standardMax: number | null;
  status: "under" | "on-target" | "over" | "no-standard" | "no-weight";
};

function ageInMonths(dob: Date | null, at: Date): number | null {
  if (!dob) return null;
  const ms = at.getTime() - dob.getTime();
  return Math.floor(ms / (30.44 * 86_400_000));
}

// The Weight Dashboard's core value over the per-cow chart already on each
// profile: a herd-wide view of who's under/over target for their age, using
// WeightStandard checkpoints (falls back to the nearest checkpoint at or
// below the animal's actual age when there's no exact match, and to a
// breed-specific standard over a generic one when both exist).
export async function getWeightStatusRows(referenceDate = new Date()): Promise<WeightStatusRow[]> {
  const [cows, standards] = await Promise.all([
    prisma.cow.findMany({
      where: { status: { notIn: ["SOLD", "DEAD"] } },
      select: { id: true, tag: true, breed: true, dateOfBirth: true },
    }),
    prisma.weightStandard.findMany({ orderBy: { ageMonths: "asc" } }),
  ]);

  const latestWeights = await prisma.weightRecord.findMany({
    orderBy: { date: "desc" },
    select: { cowId: true, weightKg: true, date: true },
  });
  const latestByCow = new Map<string, { weightKg: number; date: Date }>();
  for (const w of latestWeights) {
    if (!latestByCow.has(w.cowId)) latestByCow.set(w.cowId, { weightKg: w.weightKg, date: w.date });
  }

  function findStandard(breed: string | null, ageMonths: number | null) {
    if (ageMonths === null) return null;
    const candidates = standards.filter((s) => s.ageMonths <= ageMonths && (s.breed === breed || s.breed === null));
    if (candidates.length === 0) return null;
    // Prefer the closest (highest) age checkpoint at or below the animal's
    // age, and a breed-specific match over a generic one at that same age.
    candidates.sort((a, b) => b.ageMonths - a.ageMonths || (a.breed === breed ? -1 : 1));
    return candidates[0];
  }

  return cows
    .map((c) => {
      const latest = latestByCow.get(c.id);
      const ageMonths = ageInMonths(c.dateOfBirth, referenceDate);
      const standard = findStandard(c.breed, ageMonths);

      let status: WeightStatusRow["status"] = "no-weight";
      if (latest) {
        if (!standard) status = "no-standard";
        else if (latest.weightKg < standard.minWeightKg) status = "under";
        else if (latest.weightKg > standard.maxWeightKg) status = "over";
        else status = "on-target";
      }

      return {
        cowId: c.id,
        tag: c.tag,
        breed: c.breed,
        ageMonths,
        latestWeightKg: latest?.weightKg ?? null,
        latestWeightDate: latest?.date ?? null,
        standardMin: standard?.minWeightKg ?? null,
        standardMax: standard?.maxWeightKg ?? null,
        status,
      };
    })
    .sort((a, b) => Number(a.tag) - Number(b.tag) || a.tag.localeCompare(b.tag));
}
