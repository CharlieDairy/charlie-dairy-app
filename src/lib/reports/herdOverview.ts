import { prisma } from "@/lib/prisma";

const ACTIVE_STATUSES = ["MILKING", "DRY", "HEIFER", "CALF"] as const;

export type HerdOverview = {
  totalAnimals: number;
  activeHerdSize: number;
  milkingNow: number;
};

// Herd section stat strip. Deliberately plain snapshot counts, not
// month-over-month comparisons: Cow.createdAt reflects when each record was
// migrated into the database, not when the animal was actually registered
// (the whole herd was imported in one batch), so a "new this month" trend
// off that field would misleadingly show the entire herd as newly added for
// one month and then go silent -- worse than no trend at all. dateOfBirth
// would be the honest alternative but isn't populated for any current
// animal. Revisit once real registration/birth dates start accumulating.
export async function getHerdOverview(): Promise<HerdOverview> {
  const [totalAnimals, activeHerdSize, milkingNow] = await Promise.all([
    prisma.cow.count(),
    prisma.cow.count({ where: { status: { in: [...ACTIVE_STATUSES] } } }),
    prisma.cow.count({ where: { status: "MILKING" } }),
  ]);

  return { totalAnimals, activeHerdSize, milkingNow };
}
