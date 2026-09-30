import { prisma } from "@/lib/prisma";

const ACTIVE_STATUSES = ["MILKING", "DRY", "HEIFER", "CALF"] as const;

export type HerdOverview = {
  total: number;
  milking: number;
  pregnant: number;
  dry: number;
  calves: number;
  males: number;
  milkToday: number;
  activeHerdSize: number;
};

function dayBounds(d: Date): { start: Date; end: Date } {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// Herd section stat strip -- Channab's Animal List shows Total/Milking/
// Pregnant/Dry/Calves/Males/Milk(L) across the top. Deliberately no
// month-over-month trend here: Cow.createdAt reflects the bulk migration
// timestamp, not real registration dates, so a "new this month" comparison
// would misleadingly show the entire herd as newly added for one month.
export async function getHerdOverview(): Promise<HerdOverview> {
  const { start, end } = dayBounds(new Date());

  const [total, milking, pregnant, dry, calves, males, milkAgg, activeHerdSize] = await Promise.all([
    prisma.cow.count(),
    prisma.cow.count({ where: { status: "MILKING" } }),
    prisma.cow.count({ where: { expectedCalving: { not: null }, status: { notIn: ["SOLD", "DEAD"] } } }),
    prisma.cow.count({ where: { status: "DRY" } }),
    prisma.cow.count({ where: { status: "CALF" } }),
    prisma.cow.count({ where: { gender: "MALE", status: { notIn: ["SOLD", "DEAD"] } } }),
    prisma.milkingRecord.aggregate({ where: { date: { gte: start, lt: end } }, _sum: { litres: true } }),
    prisma.cow.count({ where: { status: { in: [...ACTIVE_STATUSES] } } }),
  ]);

  return { total, milking, pregnant, dry, calves, males, milkToday: milkAgg._sum.litres ?? 0, activeHerdSize };
}

export type AnimalCategory = { key: string; label: string; count: number };

// Channab's category tabs (All/Breeder/Pregnant/Dry/Milking/.../Calf/Other)
// -- adapted to Charlie's actual status model rather than invented category
// names that don't correspond to real data here. Sold/Dead are included so
// every status on the register is filterable from these tabs, not just the
// active-herd ones.
export async function getAnimalCategories(): Promise<AnimalCategory[]> {
  const grouped = await prisma.cow.groupBy({ by: ["status"], _count: { _all: true } });
  const countFor = (status: string) => grouped.find((g) => g.status === status)?._count._all ?? 0;
  const total = grouped.reduce((sum, g) => sum + g._count._all, 0);

  return [
    { key: "ALL", label: "All", count: total },
    { key: "MILKING", label: "Milking", count: countFor("MILKING") },
    { key: "DRY", label: "Dry", count: countFor("DRY") },
    { key: "HEIFER", label: "Heifer", count: countFor("HEIFER") },
    { key: "CALF", label: "Calf", count: countFor("CALF") },
    { key: "INSEMINATED", label: "Inseminated", count: countFor("INSEMINATED") },
    { key: "SOLD", label: "Sold", count: countFor("SOLD") },
    { key: "DEAD", label: "Dead", count: countFor("DEAD") },
  ];
}
