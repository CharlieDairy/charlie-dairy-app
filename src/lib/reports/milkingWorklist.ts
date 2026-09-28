import { prisma } from "@/lib/prisma";

export type WorklistRow = {
  cowId: string;
  tag: string;
  dim: number | null; // days in milk, from lastCalvingDate
  morning: number | null;
  afternoon: number | null;
  evening: number | null;
  total: number;
  complete: boolean; // all 3 shifts recorded
  recordedShifts: number;
};

export type MilkingWorklist = {
  date: string;
  rows: WorklistRow[];
  missingCount: number; // no shifts recorded at all
  incompleteCount: number; // 1-2 of 3 shifts recorded
  groupTotalLitres: number; // unattributed (cowId null) Herd/Group Total entries
  sessionTotals: { morning: number; afternoon: number; evening: number; total: number };
};

function dayInMilk(lastCalvingDate: Date | null, at: Date): number | null {
  if (!lastCalvingDate) return null;
  return Math.max(0, Math.floor((at.getTime() - lastCalvingDate.getTime()) / 86_400_000));
}

// Channab's "Individual Milk Records" makes it obvious at a glance who still
// needs today's entry (Missing/Incomplete counts, one row per animal) --
// Charlie's old Milking Entry was a blind single form with no such view.
// This is the worklist that page now shows above the entry form.
export async function getMilkingWorklist(dateKey: string): Promise<MilkingWorklist> {
  const start = new Date(`${dateKey}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 86_400_000);

  const cows = await prisma.cow.findMany({
    where: { status: { in: ["MILKING", "DRY"] } },
    select: { id: true, tag: true, lastCalvingDate: true },
  });
  const records = await prisma.milkingRecord.findMany({
    where: { date: { gte: start, lt: end } },
    select: { cowId: true, shift: true, litres: true },
  });

  const byCow = new Map<string, { morning: number | null; afternoon: number | null; evening: number | null }>();
  const groupByShift = { morning: 0, afternoon: 0, evening: 0 };
  for (const r of records) {
    const key = r.shift === "MORNING" ? "morning" : r.shift === "AFTERNOON" ? "afternoon" : "evening";
    if (!r.cowId) {
      groupByShift[key] += r.litres;
      continue;
    }
    const entry = byCow.get(r.cowId) ?? { morning: null, afternoon: null, evening: null };
    entry[key] = (entry[key] ?? 0) + r.litres;
    byCow.set(r.cowId, entry);
  }
  const groupTotalLitres = groupByShift.morning + groupByShift.afternoon + groupByShift.evening;

  const sorted = cows.sort((a, b) => Number(a.tag) - Number(b.tag) || a.tag.localeCompare(b.tag));
  const rows: WorklistRow[] = sorted.map((c) => {
    const e = byCow.get(c.id) ?? { morning: null, afternoon: null, evening: null };
    const recordedShifts = [e.morning, e.afternoon, e.evening].filter((v) => v !== null).length;
    return {
      cowId: c.id,
      tag: c.tag,
      dim: dayInMilk(c.lastCalvingDate, start),
      morning: e.morning,
      afternoon: e.afternoon,
      evening: e.evening,
      total: (e.morning ?? 0) + (e.afternoon ?? 0) + (e.evening ?? 0),
      complete: recordedShifts === 3,
      recordedShifts,
    };
  });

  return {
    date: dateKey,
    rows,
    missingCount: rows.filter((r) => r.recordedShifts === 0).length,
    incompleteCount: rows.filter((r) => r.recordedShifts > 0 && r.recordedShifts < 3).length,
    groupTotalLitres,
    sessionTotals: {
      morning: rows.reduce((n, r) => n + (r.morning ?? 0), 0) + groupByShift.morning,
      afternoon: rows.reduce((n, r) => n + (r.afternoon ?? 0), 0) + groupByShift.afternoon,
      evening: rows.reduce((n, r) => n + (r.evening ?? 0), 0) + groupByShift.evening,
      total: rows.reduce((n, r) => n + r.total, 0) + groupTotalLitres,
    },
  };
}
