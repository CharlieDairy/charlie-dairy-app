import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getHerdOverview, getAnimalCategories } from "@/lib/reports/herdOverview";
import StatCard from "@/components/StatCard";
import AnimalListClient from "./AnimalListClient";
import type { AnimalRow } from "./AnimalCard";

function monthsSince(d: Date | null): number | null {
  if (!d) return null;
  const ms = Date.now() - d.getTime();
  return Math.max(0, Math.round(ms / (30.44 * 86_400_000)));
}

export default async function CowsAdminPage() {
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";
  const [overview, categories, cows, statusItems, latestWeights] = await Promise.all([
    getHerdOverview(),
    getAnimalCategories(),
    prisma.cow.findMany(),
    prisma.masterDataItem.findMany({ where: { category: "COW_STATUS" }, orderBy: { sortOrder: "asc" } }),
    prisma.weightRecord.findMany({ orderBy: { date: "asc" }, select: { cowId: true, weightKg: true } }),
  ]);

  const latestWeightByCow = new Map<string, number>();
  for (const w of latestWeights) latestWeightByCow.set(w.cowId, w.weightKg); // last write wins -- ascending order, so last = most recent

  const allStatusOptions = statusItems.map((s) => ({ code: s.code, label: s.label }));
  const soldOrDeadCount = cows.filter((c) => c.status === "SOLD" || c.status === "DEAD").length;
  const activeCount = cows.length - soldOrDeadCount;

  const animals: AnimalRow[] = cows
    .sort((a, b) => Number(a.tag) - Number(b.tag) || a.tag.localeCompare(b.tag))
    .map((c) => ({
      id: c.id,
      tag: c.tag,
      breed: c.breed,
      gender: c.gender,
      status: c.status,
      photoUrl: c.photoUrl,
      dateOfBirth: c.dateOfBirth ? c.dateOfBirth.toISOString() : null,
      latestWeightKg: latestWeightByCow.get(c.id) ?? null,
      pregnant: c.expectedCalving !== null,
      monthsInStatus: c.status === "MILKING" ? monthsSince(c.lastCalvingDate) : null,
    }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Animal List</h1>
        <Link href="/admin/cows/add" className="bg-green-700 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-green-800">
          + Add Animal
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total" value={`${activeCount}/${overview.total}`} />
        <StatCard label="Milking" value={overview.milking.toString()} />
        <StatCard label="Pregnant" value={overview.pregnant.toString()} />
        <StatCard label="Dry" value={overview.dry.toString()} />
        <StatCard label="Calves" value={overview.calves.toString()} />
        <StatCard label="Males" value={overview.males.toString()} />
      </div>

      <AnimalListClient animals={animals} categories={categories} statusOptions={allStatusOptions} isAdmin={isAdmin} />
    </div>
  );
}
