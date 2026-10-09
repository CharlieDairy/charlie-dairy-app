import { prisma } from "@/lib/prisma";
import { getArAging } from "@/lib/reports/milkSalesByCustomer";
import { type FindingDraft, type Rule, addDays, key, listDates, rs } from "../types";

const BACKFILL = "Backfill (cash ledger)";
const realSale = { OR: [{ enteredBy: null }, { enteredBy: { not: BACKFILL } }] };

export const qualityRules: Rule[] = [
  {
    id: "milk.outlier",
    async run({ today }) {
      const rows = await prisma.$queryRaw<{ tag: string; date: Date; shift: string; litres: number; avg: number }[]>`
        SELECT c.tag, r.date, r.shift::text AS shift, r.litres, a.avg
        FROM "MilkingRecord" r
        JOIN "Cow" c ON c.id = r."cowId"
        JOIN (
          SELECT "cowId", shift, AVG(litres) AS avg, COUNT(*) AS n
          FROM "MilkingRecord"
          WHERE date >= ${addDays(today, -75)} AND date < ${addDays(today, -14)} AND litres > 0 AND "cowId" IS NOT NULL
          GROUP BY 1, 2
        ) a ON a."cowId" = r."cowId" AND a.shift = r.shift AND a.n >= 10
        WHERE r.date >= ${addDays(today, -14)} AND r.litres > GREATEST(a.avg * 2.2, 12)
        ORDER BY r.litres / a.avg DESC
        LIMIT 12`;
      if (rows.length === 0) return [];
      return [
        {
          key: "milk.outlier",
          ruleId: "milk.outlier",
          category: "MILK",
          severity: "MEDIUM",
          title: `${rows.length} milk record${rows.length === 1 ? "" : "s"} look too high for that cow`,
          detail: rows
            .slice(0, 6)
            .map((r) => `Cow ${r.tag} ${key(r.date)} ${r.shift.toLowerCase()}: ${r.litres} L (usually ${r.avg.toFixed(1)} L)`)
            .join("; "),
          suggestion: "Check each against the milking sheet - a misplaced decimal (e.g. 62 instead of 6.2) is the usual cause. Edit the record on Milking Entry.",
          metric: { records: rows.map((r) => ({ tag: r.tag, date: key(r.date), shift: r.shift, litres: r.litres, usual: Math.round(r.avg * 10) / 10 })) },
        },
      ];
    },
  },
  {
    id: "sale.rate-mismatch",
    async run({ today }) {
      const [sales, customers] = await Promise.all([
        prisma.milkSale.findMany({ where: { date: { gte: addDays(today, -30), lt: addDays(today, 1) }, rate: { not: null }, ...realSale }, select: { buyer: true, rate: true, date: true } }),
        prisma.customer.findMany({ select: { name: true, agreedRate: true } }),
      ]);
      const agreed = new Map(customers.map((c) => [c.name.toLowerCase(), c.agreedRate]));
      const bad = new Map<string, { n: number; rate: number; agreed: number }>();
      for (const s of sales) {
        const a = agreed.get(s.buyer.toLowerCase());
        if (a == null || s.rate == null) continue;
        if (Math.abs(s.rate - a) > 0.5) {
          const cur = bad.get(s.buyer) ?? { n: 0, rate: s.rate, agreed: a };
          cur.n++;
          bad.set(s.buyer, cur);
        }
      }
      if (bad.size === 0) return [];
      return [
        {
          key: "sale.rate-mismatch",
          ruleId: "sale.rate-mismatch",
          category: "MILK",
          severity: "MEDIUM",
          title: `Sales recorded at a rate different from the customer's fixed rate`,
          detail: Array.from(bad.entries()).map(([b, v]) => `${b}: ${v.n} sale(s) at Rs ${v.rate} (agreed Rs ${v.agreed})`).join("; "),
          suggestion: "Rates are meant to come from the Customer record. Check whether the customer's rate changed (Admin updates it on Customers) or the sales were edited.",
        },
      ];
    },
  },
  {
    id: "recon.variance",
    async run({ today }) {
      const out: FindingDraft[] = [];
      for (const days of [7, 30]) {
        const where = { date: { gte: addDays(today, -days), lt: today } };
        const [p, s, u] = await Promise.all([
          prisma.milkingRecord.aggregate({ where, _sum: { litres: true } }),
          prisma.milkSale.aggregate({ where, _sum: { litres: true } }),
          prisma.milkUsageRecord.aggregate({ where, _sum: { litres: true } }),
        ]);
        const produced = p._sum.litres ?? 0;
        if (produced < 100) continue;
        const sold = s._sum.litres ?? 0;
        const used = u._sum.litres ?? 0;
        const gap = produced - sold - used;
        const pct = (gap / produced) * 100;
        if (pct > 6 || pct < -2) {
          out.push({
            key: `recon.variance.${days}d`,
            ruleId: "recon.variance",
            category: "MILK",
            severity: pct < -2 || pct > 12 ? "HIGH" : "MEDIUM",
            title: pct < 0 ? `Sold + used is MORE than produced over the last ${days} days` : `${pct.toFixed(1)}% of the milk is unaccounted for over the last ${days} days`,
            detail: `Produced ${Math.round(produced).toLocaleString()} L, sold ${Math.round(sold).toLocaleString()} L, used on the farm ${Math.round(used).toLocaleString()} L - ${Math.round(Math.abs(gap)).toLocaleString()} L ${pct < 0 ? "too many" : "not explained"}. Normal wastage on this farm is about 1-4%.`,
            suggestion: pct < 0 ? "Sales or use were entered twice, or milking records are missing. Check the days on Production Reconciliation." : "Check for days with missing sales entries (see the missing-entries findings) or real loss at the shed.",
            metric: { days, produced, sold, used, unaccountedPct: Math.round(pct * 10) / 10 },
          });
        }
      }
      return out;
    },
  },
  {
    id: "ar.overdue",
    async run({ today }) {
      const rows = await getArAging(today);
      const out: FindingDraft[] = [];
      for (const r of rows) {
        const sev = r.over90 > 0 ? "HIGH" : r.days61to90 > 0 ? "MEDIUM" : r.days31to60 > 0 ? "LOW" : null;
        if (!sev) continue;
        out.push({
          key: `ar.overdue.${r.buyer.toLowerCase().replace(/\W+/g, "-")}`,
          ruleId: "ar.overdue",
          category: "MONEY",
          severity: sev,
          title: `${r.buyer} owes ${rs(r.total)}, some of it more than ${r.over90 > 0 ? 90 : r.days61to90 > 0 ? 60 : 30} days old`,
          detail: `Current ${rs(r.current)}, 31-60 days ${rs(r.days31to60)}, 61-90 days ${rs(r.days61to90)}, over 90 days ${rs(r.over90)}.`,
          suggestion: "Collect the payment and record it with Record Payment on Milk Sales. If the money was already received, it was probably entered as a plain cash receipt - see the Accounting finding about unlinked receipts.",
          metric: { buyer: r.buyer, total: r.total, current: r.current, d31: r.days31to60, d61: r.days61to90, d90: r.over90 },
        });
      }
      return out;
    },
  },
  {
    id: "cash.uncategorised",
    async run({ today }) {
      const n = await prisma.cashTransaction.count({
        where: { date: { gte: addDays(today, -90), lt: addDays(today, 1) }, OR: [{ category: "Uncategorized" }, { category: "" }] },
      });
      if (n === 0) return [];
      return [
        {
          key: "cash.uncategorised",
          ruleId: "cash.uncategorised",
          category: "MONEY",
          severity: "LOW",
          title: `${n} cash entr${n === 1 ? "y has" : "ies have"} no category in the last 90 days`,
          detail: "Entries without a category cannot be placed in the profit and loss, so profit by type of income or cost is incomplete.",
          suggestion: "Open the Cash Register, edit each entry and choose a category.",
          metric: { count: n },
        },
      ];
    },
  },
  {
    id: "cash.duplicates",
    async run({ today }) {
      const rows = await prisma.$queryRaw<{ date: Date; party: string | null; category: string; amountIn: number; amountOut: number; n: number }[]>`
        SELECT date, party, category, "amountIn", "amountOut", COUNT(*)::int AS n
        FROM "CashTransaction"
        WHERE date >= ${addDays(today, -60)} AND ("amountIn" > 0 OR "amountOut" > 0)
        GROUP BY date, party, category, "amountIn", "amountOut"
        HAVING COUNT(*) > 1
        ORDER BY date DESC
        LIMIT 10`;
      if (rows.length === 0) return [];
      return [
        {
          key: "cash.duplicates",
          ruleId: "cash.duplicates",
          category: "MONEY",
          severity: "LOW",
          title: `${rows.length} identical cash entr${rows.length === 1 ? "y" : "ies"} on the same day`,
          detail: rows.slice(0, 5).map((r) => `${key(r.date)} ${r.category}${r.party ? ` / ${r.party}` : ""} ${rs(r.amountIn || r.amountOut)} x${r.n}`).join("; "),
          suggestion: "If a pair is a double entry, delete one. If both are real (two identical payments), ignore this.",
          metric: { rows: rows.map((r) => ({ date: key(r.date), category: r.category, party: r.party, amount: r.amountIn || r.amountOut, times: r.n })) },
        },
      ];
    },
  },
];

// kept for the AI snapshot
export { listDates };
