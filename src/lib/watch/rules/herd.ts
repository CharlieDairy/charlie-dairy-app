import { prisma } from "@/lib/prisma";
import { getActiveWithdrawals } from "@/lib/reports/withdrawal";
import { type Rule, addDays, daysBetween, key, listDates } from "../types";

const INACTIVE = ["SOLD", "DEAD"] as const;

export const herdRules: Rule[] = [
  {
    id: "health.vaccination-overdue",
    async run({ today }) {
      const records = await prisma.vaccinationRecord.findMany({
        where: { cow: { status: { notIn: [...INACTIVE] } } },
        select: { cowId: true, vaccineName: true, date: true, nextDueDate: true, cow: { select: { tag: true } } },
      });
      const latest = new Map<string, (typeof records)[number]>();
      for (const r of records) {
        const k = `${r.cowId}|${r.vaccineName.toLowerCase()}`;
        const cur = latest.get(k);
        if (!cur || r.date > cur.date) latest.set(k, r);
      }
      const overdue = [...latest.values()].filter((r) => r.nextDueDate && r.nextDueDate < today).sort((a, b) => a.nextDueDate!.getTime() - b.nextDueDate!.getTime());
      if (overdue.length === 0) return [];
      const worst = daysBetween(today, overdue[0].nextDueDate!);
      return [
        {
          key: "health.vaccination-overdue",
          ruleId: "health.vaccination-overdue",
          category: "HEALTH",
          severity: worst > 30 ? "HIGH" : "MEDIUM",
          title: `${overdue.length} vaccination${overdue.length === 1 ? " is" : "s are"} overdue`,
          detail: overdue.slice(0, 8).map((r) => `Cow ${r.cow.tag} - ${r.vaccineName} was due ${key(r.nextDueDate!)} (${daysBetween(today, r.nextDueDate!)} days ago)`).join("; "),
          suggestion: "Vaccinate and record it on Vaccination Entry. The next due date is calculated from the new record.",
          metric: { count: overdue.length, worstDaysOverdue: worst },
        },
      ];
    },
  },
  {
    id: "breeding.pd-due",
    async run({ today }) {
      const ins = await prisma.insemination.findMany({
        where: { date: { gte: addDays(today, -120), lte: addDays(today, -45) }, cow: { status: { notIn: [...INACTIVE] } } },
        select: { cowId: true, date: true, cow: { select: { tag: true } } },
        orderBy: { date: "desc" },
      });
      if (ins.length === 0) return [];
      const checks = await prisma.pregnancyCheck.findMany({ where: { cowId: { in: ins.map((i) => i.cowId) } }, select: { cowId: true, date: true } });
      const due = ins.filter((i) => !checks.some((c) => c.cowId === i.cowId && c.date >= i.date));
      if (due.length === 0) return [];
      return [
        {
          key: "breeding.pd-due",
          ruleId: "breeding.pd-due",
          category: "HERD",
          severity: "MEDIUM",
          title: `${due.length} inseminated cow${due.length === 1 ? "" : "s"} need a pregnancy check`,
          detail: due.slice(0, 8).map((i) => `Cow ${i.cow.tag} - inseminated ${key(i.date)} (${daysBetween(today, i.date)} days ago)`).join("; "),
          suggestion: "Pregnancy-check around day 45-60 after insemination and record the result; an open cow can be re-served sooner.",
          metric: { count: due.length },
        },
      ];
    },
  },
  {
    id: "breeding.calving-and-dry-off",
    async run({ today }) {
      const cows = await prisma.cow.findMany({
        where: { status: { notIn: [...INACTIVE] }, OR: [{ expectedCalving: { not: null } }, { dryDate: { not: null } }] },
        select: { tag: true, status: true, expectedCalving: true, dryDate: true, lastCalvingDate: true },
      });
      const soon: string[] = [];
      const overdueCalving: string[] = [];
      const dryDue: string[] = [];
      for (const c of cows) {
        if (c.expectedCalving) {
          const d = daysBetween(c.expectedCalving, today);
          const calvedSince = c.lastCalvingDate && c.lastCalvingDate >= addDays(c.expectedCalving, -30);
          if (!calvedSince && d >= 0 && d <= 14) soon.push(`Cow ${c.tag} (${key(c.expectedCalving)})`);
          if (!calvedSince && d < -7 && d > -90) overdueCalving.push(`Cow ${c.tag} (was due ${key(c.expectedCalving)})`);
        }
        if (c.dryDate && c.status === "MILKING") {
          const d = daysBetween(c.dryDate, today);
          if (d <= 14 && d > -60) dryDue.push(`Cow ${c.tag} (${d < 0 ? `${-d} days late` : `due ${key(c.dryDate)}`})`);
        }
      }
      const out = [];
      if (soon.length) out.push({ key: "breeding.calving-soon", ruleId: "breeding.calving-and-dry-off", category: "HERD" as const, severity: "MEDIUM" as const, title: `${soon.length} cow${soon.length === 1 ? "" : "s"} due to calve within 2 weeks`, detail: soon.join("; "), suggestion: "Move them to the calving pen, check the calving kit, and plan the colostrum for the calf." });
      if (overdueCalving.length) out.push({ key: "breeding.calving-overdue", ruleId: "breeding.calving-and-dry-off", category: "HERD" as const, severity: "MEDIUM" as const, title: `${overdueCalving.length} cow${overdueCalving.length === 1 ? "" : "s"} past the expected calving date with no calving recorded`, detail: overdueCalving.join("; "), suggestion: "Either the calving was not recorded (add it on Calving Entry) or the pregnancy date was wrong - recheck with a pregnancy test." });
      if (dryDue.length) out.push({ key: "breeding.dry-off-due", ruleId: "breeding.calving-and-dry-off", category: "HERD" as const, severity: "MEDIUM" as const, title: `${dryDue.length} milking cow${dryDue.length === 1 ? " is" : "s are"} due to be dried off`, detail: dryDue.join("; "), suggestion: "Dry off about 60 days before calving, then update the cow's status." });
      return out;
    },
  },
  {
    id: "herd.no-milk",
    async run({ today }) {
      const since = addDays(today, -7);
      const [cows, recs] = await Promise.all([
        prisma.cow.findMany({ where: { status: "MILKING" }, select: { id: true, tag: true } }),
        prisma.milkingRecord.groupBy({ by: ["cowId"], where: { date: { gte: since, lt: today }, cowId: { not: null } }, _count: { _all: true } }),
      ]);
      if (recs.length === 0) return []; // nothing entered at all: the missing-days rule covers that
      const have = new Set(recs.map((r) => r.cowId));
      const none = cows.filter((c) => !have.has(c.id));
      if (none.length === 0) return [];
      return [
        {
          key: "herd.no-milk",
          ruleId: "herd.no-milk",
          category: "HERD",
          severity: "MEDIUM",
          title: `${none.length} cow${none.length === 1 ? "" : "s"} marked MILKING had no milk recorded in the last 7 days`,
          detail: `Cows ${none.map((c) => c.tag).join(", ")}. Either they are not being milked or their entries are missing.`,
          suggestion: "If a cow has dried off, was sold or died, change her status so she stops appearing in the milking list.",
          metric: { cows: none.map((c) => c.tag) },
        },
      ];
    },
  },
  {
    id: "herd.status-mismatch",
    async run({ today }) {
      const rows = await prisma.milkingRecord.findMany({
        where: { date: { gte: addDays(today, -14), lt: addDays(today, 1) }, cow: { status: { in: ["SOLD", "DEAD", "CALF", "HEIFER"] } } },
        distinct: ["cowId"],
        select: { cow: { select: { tag: true, status: true } } },
      });
      if (rows.length === 0) return [];
      return [
        {
          key: "herd.status-mismatch",
          ruleId: "herd.status-mismatch",
          category: "INTEGRITY",
          severity: "MEDIUM",
          title: `${rows.length} animal${rows.length === 1 ? "" : "s"} with recent milk records have a status that says they are not milking`,
          detail: rows.map((r) => `Cow ${r.cow?.tag} is ${r.cow?.status}`).join("; "),
          suggestion: "Correct the animal's status (or the milking record's cow) so the herd counts are right.",
        },
      ];
    },
  },
  {
    id: "health.withdrawal",
    async run({ today }) {
      const w = await getActiveWithdrawals(today);
      if (w.length === 0) return [];
      return [
        {
          key: "health.withdrawal",
          ruleId: "health.withdrawal",
          category: "HEALTH",
          severity: "MEDIUM",
          title: `${w.length} cow${w.length === 1 ? " is" : "s are"} inside a milk withdrawal period`,
          detail: w.map((x) => `Cow ${x.cowTag} (${x.medicineName}) until ${key(x.withdrawalUntil)}`).join("; "),
          suggestion: "Milk from these cows must be kept out of what is sold or fed to calves until the date shown.",
          metric: { cows: w.map((x) => ({ tag: x.cowTag, until: key(x.withdrawalUntil) })) },
        },
      ];
    },
  },
  {
    id: "weight.stale",
    async run({ today }) {
      const young = await prisma.cow.findMany({
        where: { status: { in: ["CALF", "HEIFER"] } },
        select: { tag: true, weightRecords: { orderBy: { date: "desc" }, take: 1, select: { date: true } } },
      });
      const stale = young.filter((c) => !c.weightRecords[0] || c.weightRecords[0].date < addDays(today, -90));
      if (stale.length === 0) return [];
      return [
        {
          key: "weight.stale",
          ruleId: "weight.stale",
          category: "HERD",
          severity: "LOW",
          title: `${stale.length} calf / heifer animal${stale.length === 1 ? " has" : "s have"} not been weighed in 90 days`,
          detail: `Animals ${stale.slice(0, 12).map((c) => c.tag).join(", ")}${stale.length > 12 ? "…" : ""}.`,
          suggestion: "Weigh young stock every 1-3 months to catch poor growth early (Weight Entry).",
        },
      ];
    },
  },
];

export { listDates };
