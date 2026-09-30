import Link from "next/link";
import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getHerdOverview, getAnimalCategories } from "@/lib/reports/herdOverview";
import StatCard from "@/components/StatCard";
import AnimalListClient from "./AnimalListClient";
import type { AnimalRow } from "./AnimalCard";

function Ic({ children }: { children: ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const IconUsers = <Ic><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></Ic>;
const IconDroplet = <Ic><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" /></Ic>;
const IconHeart = <Ic><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></Ic>;
const IconPause = <Ic><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></Ic>;
const IconSprout = <Ic><path d="M7 20h10" /><path d="M12 20v-8" /><path d="M12 12C12 7 7 4 3 4c0 5 3 9 9 9z" /><path d="M12 12c0-4 4-7 9-7 0 4-3 8-9 8z" /></Ic>;
const IconMale = <Ic><circle cx="10" cy="14" r="6" /><path d="M14.5 9.5L20 4" /><path d="M15 4h5v5" /></Ic>;
const IconRatio = <Ic><circle cx="8" cy="12" r="5" /><circle cx="16" cy="12" r="5" /></Ic>;

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
  const nonMilkingActiveCount = activeCount - overview.milking;

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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <StatCard label="Total" value={`${activeCount}/${overview.total}`} icon={IconUsers} iconTone="brand" />
        <StatCard label="Milking" value={overview.milking.toString()} icon={IconDroplet} iconTone="brand" />
        <StatCard label="Pregnant" value={overview.pregnant.toString()} icon={IconHeart} iconTone="brand" />
        <StatCard label="Dry" value={overview.dry.toString()} icon={IconPause} iconTone="brand" />
        <StatCard label="Calves" value={overview.calves.toString()} icon={IconSprout} iconTone="brand" />
        <StatCard label="Males" value={overview.males.toString()} icon={IconMale} iconTone="brand" />
        <StatCard label="Milking : Non-Milking" value={`${overview.milking}:${nonMilkingActiveCount}`} icon={IconRatio} iconTone="brand" />
      </div>

      <AnimalListClient animals={animals} categories={categories} statusOptions={allStatusOptions} isAdmin={isAdmin} />
    </div>
  );
}
