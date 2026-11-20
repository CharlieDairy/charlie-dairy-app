import { prisma } from "@/lib/prisma";
import { farmDateKey } from "@/lib/reports/dashboardMetrics";

// The Admin's daily notification: everything the farm manager (the Editor users) entered, by the day it was entered
// (Pakistan time), counted from the records themselves, so it can never miss an entry or depend on a scheduled job.
// A day with entries stays a notification until the Admin marks it reviewed. Only NEW entries count; a later edit to an
// old record is not a new entry.

// Pakistan has no daylight saving: a farm day is 00:00 to 24:00 at UTC+5.
const PKT_MS = 5 * 3_600_000;
const DAY_MS = 86_400_000;

export function farmDayRange(day: string): { start: Date; end: Date } {
  const start = new Date(new Date(`${day}T00:00:00Z`).getTime() - PKT_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

export function farmDayOfInstant(d: Date): string {
  return new Date(d.getTime() + PKT_MS).toISOString().slice(0, 10);
}

/** `today` and the days before it, newest first. */
export function lastDays(today: string, n: number): string[] {
  const t = new Date(`${today}T00:00:00Z`).getTime();
  return Array.from({ length: n }, (_, i) => new Date(t - i * DAY_MS).toISOString().slice(0, 10));
}

export function validFarmDay(v: string | undefined): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v ? v : null;
}

/** Entries per farm day from the moments they were entered. */
export function countByDay(stamps: Date[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of stamps) {
    const k = farmDayOfInstant(s);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export type NoticeDay = { day: string; total: number };

/**
 * What the Admin should look at: finished days that have entries and are not reviewed yet (a day can only be reviewed once
 * it is over, so late entries are never hidden by an early tick), plus today's running count.
 */
export function buildNotice(today: string, totals: Map<string, number>, reviewed: Set<string>, days: number): { pastDays: NoticeDay[]; today: number } {
  const pastDays = lastDays(today, days)
    .filter((d) => d !== today)
    .map((day) => ({ day, total: totals.get(day) ?? 0 }))
    .filter((d) => d.total > 0 && !reviewed.has(d.day));
  return { pastDays, today: totals.get(today) ?? 0 };
}

type Where = { enteredBy: { in: string[] }; createdAt: { gte: Date; lt: Date } };
type Source = {
  key: string;
  label: string;
  href: string;
  /** when each new entry was made */
  stamps: (w: Where) => Promise<Date[]>;
  /** a one-line total worth seeing at a glance */
  detail?: (w: Where) => Promise<string | null>;
};

const rs = (n: number | null | undefined) => `Rs ${Math.round(n ?? 0).toLocaleString("en-US")}`;
const s = (rows: { createdAt: Date }[]) => rows.map((r) => r.createdAt);
const sel = { createdAt: true } as const;

const SOURCES: Source[] = [
  {
    key: "milking", label: "Milk records (per cow, per milking)", href: "/entry/milking",
    stamps: async (w) => s(await prisma.milkingRecord.findMany({ where: w, select: sel })),
    detail: async (w) => `${((await prisma.milkingRecord.aggregate({ where: w, _sum: { litres: true } }))._sum.litres ?? 0).toFixed(1)} L`,
  },
  {
    key: "usage", label: "Milk use (house, calves, waste)", href: "/entry/milking",
    stamps: async (w) => s(await prisma.milkUsageRecord.findMany({ where: w, select: sel })),
    detail: async (w) => `${((await prisma.milkUsageRecord.aggregate({ where: w, _sum: { litres: true } }))._sum.litres ?? 0).toFixed(1)} L`,
  },
  {
    key: "milkSale", label: "Milk sales", href: "/admin/reports/milk-sales",
    stamps: async (w) => s(await prisma.milkSale.findMany({ where: w, select: sel })),
    detail: async (w) => {
      const a = await prisma.milkSale.aggregate({ where: w, _sum: { amount: true, litres: true } });
      return `${rs(a._sum.amount)} · ${(a._sum.litres ?? 0).toFixed(1)} L`;
    },
  },
  {
    key: "payment", label: "Customer payments received", href: "/admin/reports/milk-sales",
    stamps: async (w) => s(await prisma.customerPayment.findMany({ where: w, select: sel })),
    detail: async (w) => rs((await prisma.customerPayment.aggregate({ where: w, _sum: { amount: true } }))._sum.amount),
  },
  {
    key: "cash", label: "Cash Register entries (salary and customer payments also appear here)", href: "/admin/reports/cash-register",
    stamps: async (w) => s(await prisma.cashTransaction.findMany({ where: w, select: sel })),
    detail: async (w) => {
      const a = await prisma.cashTransaction.aggregate({ where: w, _sum: { amountIn: true, amountOut: true } });
      return `In ${rs(a._sum.amountIn)} · Out ${rs(a._sum.amountOut)}`;
    },
  },
  {
    key: "feed", label: "Feed in / out", href: "/admin/reports/feed",
    stamps: async (w) => s(await prisma.feedTransaction.findMany({ where: w, select: sel })),
  },
  {
    key: "salary", label: "Salary payments", href: "/admin/team",
    stamps: async (w) => s(await prisma.salaryPayment.findMany({ where: w, select: sel })),
    detail: async (w) => rs((await prisma.salaryPayment.aggregate({ where: w, _sum: { amount: true } }))._sum.amount),
  },
  { key: "attendance", label: "Attendance", href: "/admin/team/attendance-reports", stamps: async (w) => s(await prisma.attendanceRecord.findMany({ where: w, select: sel })) },
  { key: "vaccination", label: "Vaccinations", href: "/admin/reports/health", stamps: async (w) => s(await prisma.vaccinationRecord.findMany({ where: w, select: sel })) },
  { key: "treatment", label: "Treatments", href: "/admin/reports/health", stamps: async (w) => s(await prisma.treatmentRecord.findMany({ where: w, select: sel })) },
  { key: "medicine", label: "Medicine stock", href: "/admin/health/medicines/stock", stamps: async (w) => s(await prisma.medicineStockTransaction.findMany({ where: w, select: sel })) },
  { key: "weight", label: "Weights", href: "/admin/reports/weight", stamps: async (w) => s(await prisma.weightRecord.findMany({ where: w, select: sel })) },
  { key: "movement", label: "Animal movements", href: "/admin/cows", stamps: async (w) => s(await prisma.cowMovement.findMany({ where: w, select: sel })) },
  { key: "heat", label: "Heat events", href: "/admin/reports/breeding", stamps: async (w) => s(await prisma.heatEvent.findMany({ where: w, select: sel })) },
  { key: "ai", label: "Inseminations", href: "/admin/reports/breeding", stamps: async (w) => s(await prisma.insemination.findMany({ where: w, select: sel })) },
  { key: "calving", label: "Calvings", href: "/admin/reports/breeding", stamps: async (w) => s(await prisma.calving.findMany({ where: w, select: sel })) },
  { key: "note", label: "Daily notes", href: "/entry/daily", stamps: async (w) => s(await prisma.dailyNote.findMany({ where: w, select: sel })) },
];

/** Names the farm manager's entries are recorded under: every user with the Editor role, active or not. */
export async function farmManagerNames(): Promise<string[]> {
  const users = await prisma.user.findMany({ where: { role: "EDITOR" }, select: { name: true } });
  return [...new Set(users.map((u) => u.name))];
}

const windowWhere = (names: string[], start: Date, end: Date): Where => ({ enteredBy: { in: names }, createdAt: { gte: start, lt: end } });

/** Entries per farm day over the last `days` days (today included), all entry types together. */
export async function recentTotals(days: number): Promise<{ today: string; totals: Map<string, number> }> {
  const today = farmDateKey();
  const names = await farmManagerNames();
  if (!names.length) return { today, totals: new Map() };
  const oldest = lastDays(today, days)[days - 1];
  const w = windowWhere(names, farmDayRange(oldest).start, farmDayRange(today).end);
  const all = await Promise.all(SOURCES.map((src) => src.stamps(w)));
  return { today, totals: countByDay(all.flat()) };
}

export type DayLine = { key: string; label: string; href: string; count: number; detail: string | null };

/** The one day's entries, by type; types with nothing entered are left out. */
export async function dayActivity(day: string): Promise<{ lines: DayLine[]; total: number }> {
  const names = await farmManagerNames();
  if (!names.length) return { lines: [], total: 0 };
  const { start, end } = farmDayRange(day);
  const w = windowWhere(names, start, end);
  const rows = await Promise.all(
    SOURCES.map(async (src) => {
      const count = (await src.stamps(w)).length;
      return { key: src.key, label: src.label, href: src.href, count, detail: count && src.detail ? await src.detail(w) : null };
    }),
  );
  const lines = rows.filter((r) => r.count > 0);
  return { lines, total: lines.reduce((n, l) => n + l.count, 0) };
}

export async function reviewedDays(days: string[]): Promise<Set<string>> {
  const rows = await prisma.activityReview.findMany({ where: { day: { in: days } }, select: { day: true } });
  return new Set(rows.map((r) => r.day));
}

/** What the dashboard banner shows the Admin. Never throws: a notification must not break the dashboard. */
export async function activityNotice(days = 14): Promise<{ pastDays: NoticeDay[]; today: number } | null> {
  try {
    const { today, totals } = await recentTotals(days);
    return buildNotice(today, totals, await reviewedDays([...totals.keys()]), days);
  } catch (e) {
    console.error("[activity] notice failed", e);
    return null;
  }
}
