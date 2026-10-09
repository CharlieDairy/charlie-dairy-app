import { prisma } from "@/lib/prisma";
import { type FindingDraft, type Rule, addDays, daysBetween, key, listDates } from "../types";

const BACKFILL = "Backfill (cash ledger)";
const realSale = { OR: [{ enteredBy: null }, { enteredBy: { not: BACKFILL } }] };

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const ADMIN_NOTE = "Editors can only enter today's date; an Admin has to enter or upload the past days.";

export const dataEntryRules: Rule[] = [
  {
    id: "milk.missing-days",
    async run({ today }) {
      const since = addDays(today, -7);
      const rows = await prisma.milkingRecord.groupBy({ by: ["date"], where: { date: { gte: since, lt: today } }, _count: { _all: true } });
      const have = new Set(rows.map((r) => key(r.date)));
      const missing: string[] = [];
      for (let i = 7; i >= 1; i--) {
        const k = key(addDays(today, -i));
        if (!have.has(k)) missing.push(k);
      }
      if (missing.length === 0) return [];
      const last = await prisma.milkingRecord.findFirst({ orderBy: { date: "desc" }, select: { date: true } });
      const ago = last ? daysBetween(today, last.date) : null;
      const out: FindingDraft = {
        key: "milk.missing-days",
        ruleId: "milk.missing-days",
        category: "DATA_ENTRY",
        severity: missing.length >= 2 ? "HIGH" : "MEDIUM",
        title: `No milking entered for ${missing.length} of the last 7 days`,
        detail: `Missing: ${listDates(missing)}.${last ? ` The last milking on record is ${key(last.date)} (${ago} days ago).` : ""} Production, reconciliation and the cow reports are incomplete until these are entered.`,
        suggestion: `Enter the missing milkings (Bulk Data can load a whole sheet at once). ${ADMIN_NOTE}`,
        metric: { missingDates: missing, lastEntry: last ? key(last.date) : null },
      };
      return [out];
    },
  },
  {
    id: "milk.incomplete-days",
    async run({ today }) {
      const recent = await prisma.milkingRecord.groupBy({ by: ["date"], where: { date: { gte: addDays(today, -7), lt: today } }, _count: { _all: true } });
      const base = await prisma.milkingRecord.groupBy({ by: ["date"], where: { date: { gte: addDays(today, -35), lt: addDays(today, -7) } }, _count: { _all: true } });
      const baseline = median(base.map((b) => b._count._all));
      if (baseline < 10) return [];
      const thin = recent.filter((r) => r._count._all < baseline * 0.8).map((r) => ({ date: key(r.date), n: r._count._all }));
      if (thin.length === 0) return [];
      return [
        {
          key: "milk.incomplete-days",
          ruleId: "milk.incomplete-days",
          category: "DATA_ENTRY",
          severity: "MEDIUM",
          title: `${thin.length} recent day${thin.length === 1 ? "" : "s"} have fewer milk records than usual`,
          detail: `A normal day has about ${Math.round(baseline)} cow-shift records. ${thin.map((t) => `${listDates([t.date])}: ${t.n}`).join("; ")}. Some cows or sessions were probably not entered.`,
          suggestion: "Open Milking Entry for those days: rows shaded red or amber show which cows still need a record.",
          metric: { baseline, days: thin },
        },
      ];
    },
  },
  {
    id: "sales.missing-days",
    async run({ today }) {
      const since = addDays(today, -7);
      const [milk, sales] = await Promise.all([
        prisma.milkingRecord.groupBy({ by: ["date"], where: { date: { gte: since, lt: today } }, _count: { _all: true } }),
        prisma.milkSale.groupBy({ by: ["date"], where: { date: { gte: since, lt: today }, ...realSale }, _count: { _all: true } }),
      ]);
      const sold = new Set(sales.map((s) => key(s.date)));
      const missing = milk.map((m) => key(m.date)).filter((d) => !sold.has(d)).sort();
      if (missing.length === 0) return [];
      return [
        {
          key: "sales.missing-days",
          ruleId: "sales.missing-days",
          category: "DATA_ENTRY",
          severity: missing.length >= 3 ? "HIGH" : "MEDIUM",
          title: `Milk was produced but no sale was recorded on ${missing.length} day${missing.length === 1 ? "" : "s"}`,
          detail: `${listDates(missing)}. Without sales entries the reconciliation shows all that milk as unaccounted, and customers' balances are understated.`,
          suggestion: `Record each day's sales on Milk Sale Entry (and calf / farm / employee use as internal use). ${ADMIN_NOTE}`,
          metric: { dates: missing },
        },
      ];
    },
  },
  {
    id: "cash.stale",
    async run({ today }) {
      const last = await prisma.cashTransaction.findFirst({ orderBy: { date: "desc" }, select: { date: true } });
      if (!last) return [];
      const days = daysBetween(today, last.date);
      if (days < 4) return [];
      return [
        {
          key: "cash.stale",
          ruleId: "cash.stale",
          category: "DATA_ENTRY",
          severity: days >= 8 ? "HIGH" : "MEDIUM",
          title: `No cash entries for ${days} days`,
          detail: `The last Cash Register entry is dated ${key(last.date)}. The cash book, cash flow and profit are out of date by that much.`,
          suggestion: `Enter the missing receipts and payments (Cash Entry, or Bulk Data for a sheet). ${ADMIN_NOTE}`,
          metric: { lastEntry: key(last.date), daysSince: days },
        },
      ];
    },
  },
  {
    id: "feed.stale",
    async run({ today }) {
      const last = await prisma.feedTransaction.findFirst({ where: { direction: "OUT" }, orderBy: { date: "desc" }, select: { date: true } });
      if (!last) return [];
      const days = daysBetween(today, last.date);
      if (days < 4) return [];
      return [
        {
          key: "feed.stale",
          ruleId: "feed.stale",
          category: "DATA_ENTRY",
          severity: days >= 8 ? "HIGH" : "MEDIUM",
          title: `No feed issued entries for ${days} days`,
          detail: `The last feed OUT entry is dated ${key(last.date)}. Feed stock and feed cost are overstated by about ${days} days of feeding.`,
          suggestion: `Record the daily feed given (Feed Entry). ${ADMIN_NOTE}`,
          metric: { lastEntry: key(last.date), daysSince: days },
        },
      ];
    },
  },
  {
    id: "team.attendance-stale",
    async run({ today }) {
      const [count, active] = await Promise.all([prisma.attendanceRecord.count(), prisma.employee.count({ where: { active: true } })]);
      if (count === 0 || active === 0) return [];
      const last = await prisma.attendanceRecord.findFirst({ orderBy: { date: "desc" }, select: { date: true } });
      if (!last) return [];
      const days = daysBetween(today, last.date);
      if (days < 4) return [];
      return [
        {
          key: "team.attendance-stale",
          ruleId: "team.attendance-stale",
          category: "TEAM",
          severity: "LOW",
          title: `No attendance marked for ${days} days`,
          detail: `Last attendance record: ${key(last.date)}.`,
          suggestion: "Mark attendance daily so salary and leave can be checked against it.",
        },
      ];
    },
  },
];
