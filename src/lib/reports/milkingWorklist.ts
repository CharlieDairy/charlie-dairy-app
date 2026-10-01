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

export type MilkingLogRow = {
  key: string;
  cowId: string | null;
  tag: string; // "Group" for unattributed herd-total rows
  date: string;
  dim: number | null;
  morning: number | null;
  afternoon: number | null;
  evening: number | null;
  total: number;
};

const LOG_ROW_CAP = 300;

// A log of actual recorded entries across a period (one row per cow+date
// that has data), for the Milking Entry page's period view -- unlike the
// single-day worklist above, this isn't a "who's missing" checklist, it's a
// browsable record of what's already been saved, matching Channab's
// "Individual Milk Records" period listing.
export async function getMilkingLog(range: { start: Date; end: Date } | null): Promise<{ rows: MilkingLogRow[]; truncated: boolean }> {
  const records = await prisma.milkingRecord.findMany({
    where: range ? { date: { gte: range.start, lt: range.end } } : undefined,
    select: { cowId: true, date: true, shift: true, litres: true },
  });

  const cowIds = Array.from(new Set(records.map((r) => r.cowId).filter((id): id is string => id !== null)));
  const cows = cowIds.length
    ? await prisma.cow.findMany({ where: { id: { in: cowIds } }, select: { id: true, tag: true, lastCalvingDate: true } })
    : [];
  const cowById = new Map(cows.map((c) => [c.id, c]));

  const byKey = new Map<string, { cowId: string | null; date: string; morning: number | null; afternoon: number | null; evening: number | null }>();
  for (const r of records) {
    const dateKey = r.date.toISOString().slice(0, 10);
    const key = `${r.cowId ?? "group"}|${dateKey}`;
    const entry = byKey.get(key) ?? { cowId: r.cowId, date: dateKey, morning: null, afternoon: null, evening: null };
    const field = r.shift === "MORNING" ? "morning" : r.shift === "AFTERNOON" ? "afternoon" : "evening";
    entry[field] = (entry[field] ?? 0) + r.litres;
    byKey.set(key, entry);
  }

  const rows: MilkingLogRow[] = Array.from(byKey.entries())
    .map(([key, e]) => {
      const cow = e.cowId ? cowById.get(e.cowId) : undefined;
      return {
        key,
        cowId: e.cowId,
        tag: e.cowId ? (cow?.tag ?? "—") : "Group",
        date: e.date,
        dim: e.cowId ? dayInMilk(cow?.lastCalvingDate ?? null, new Date(`${e.date}T00:00:00.000Z`)) : null,
        morning: e.morning,
        afternoon: e.afternoon,
        evening: e.evening,
        total: (e.morning ?? 0) + (e.afternoon ?? 0) + (e.evening ?? 0),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || Number(a.tag) - Number(b.tag) || a.tag.localeCompare(b.tag));

  return { rows: rows.slice(0, LOG_ROW_CAP), truncated: rows.length > LOG_ROW_CAP };
}
