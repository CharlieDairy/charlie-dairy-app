import { prisma } from "@/lib/prisma";
import { farmDateKey } from "@/lib/reports/dashboardMetrics";
import { breedingTag, countByCode, type BreedingTag } from "./status";

// Loads each female animal's latest breeding events and applies the tag rules (status.ts). Read-only.

export type BreedingRow = {
  id: string;
  tag: string;
  status: string;
  breeding: BreedingTag | null;
  lastInseminationDate: string | null;
};

const newest = (a: Date | null | undefined, b: Date | null | undefined): Date | null => (a && b ? (a > b ? a : b) : a ?? b ?? null);

/** The breeding tag of every female animal still on the farm, sorted by tag number. */
export async function getBreedingRows(): Promise<BreedingRow[]> {
  const today = new Date(`${farmDateKey()}T00:00:00.000Z`);
  const [cows, ai, heat, calving, checks] = await Promise.all([
    prisma.cow.findMany({
      where: { gender: "FEMALE", status: { notIn: ["SOLD", "DEAD"] } },
      select: { id: true, tag: true, status: true, gender: true, dateOfBirth: true, expectedCalving: true, lastCalvingDate: true },
    }),
    prisma.insemination.groupBy({ by: ["cowId"], _max: { date: true } }),
    prisma.heatEvent.groupBy({ by: ["cowId"], _max: { detectedAt: true } }),
    prisma.calving.groupBy({ by: ["damId"], _max: { date: true } }),
    prisma.pregnancyCheck.findMany({ orderBy: { date: "desc" }, select: { cowId: true, date: true, result: true } }),
  ]);
  const lastAi = new Map(ai.map((r) => [r.cowId, r._max.date]));
  const lastHeat = new Map(heat.map((r) => [r.cowId, r._max.detectedAt]));
  const lastCalvingRec = new Map(calving.map((r) => [r.damId, r._max.date]));
  const lastCheck = new Map<string, { date: Date; result: string }>();
  for (const c of checks) if (!lastCheck.has(c.cowId)) lastCheck.set(c.cowId, { date: c.date, result: c.result });

  return cows
    .map((c) => ({
      id: c.id,
      tag: c.tag,
      status: c.status as string,
      lastInseminationDate: lastAi.get(c.id)?.toISOString().slice(0, 10) ?? null,
      breeding: breedingTag(
        {
          gender: c.gender,
          status: c.status,
          dateOfBirth: c.dateOfBirth,
          expectedCalving: c.expectedCalving,
          lastCalving: newest(c.lastCalvingDate, lastCalvingRec.get(c.id)),
          lastHeat: lastHeat.get(c.id) ?? null,
          lastInsemination: lastAi.get(c.id) ?? null,
          lastCheck: lastCheck.get(c.id) ?? null,
        },
        today,
      ),
    }))
    .sort((a, b) => Number(a.tag) - Number(b.tag) || a.tag.localeCompare(b.tag));
}

/** Tags by animal id, for pages that show one tag per animal. */
export async function getBreedingTagMap(): Promise<Map<string, BreedingTag | null>> {
  return new Map((await getBreedingRows()).map((r) => [r.id, r.breeding]));
}

/** Counts per stage and how many animals need the farm manager's action now. */
export async function getBreedingSummary() {
  const rows = await getBreedingRows();
  const counts = countByCode(rows.map((r) => r.breeding));
  return { rows, counts, needsAction: rows.filter((r) => r.breeding?.needsAction).length };
}
