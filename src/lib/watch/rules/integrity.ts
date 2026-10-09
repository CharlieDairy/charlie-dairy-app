import { prisma } from "@/lib/prisma";
import { type Rule, key } from "../types";

const BACKFILL = "Backfill (cash ledger)";

export const integrityRules: Rule[] = [
  {
    id: "data.future-dated",
    async run({ today }) {
      const after = new Date(today.getTime() + 86_400_000 - 1);
      const [milk, sale, cash, feed, use] = await Promise.all([
        prisma.milkingRecord.count({ where: { date: { gt: after } } }),
        prisma.milkSale.count({ where: { date: { gt: after } } }),
        prisma.cashTransaction.count({ where: { date: { gt: after } } }),
        prisma.feedTransaction.count({ where: { date: { gt: after } } }),
        prisma.milkUsageRecord.count({ where: { date: { gt: after } } }),
      ]);
      const parts = [milk && `${milk} milking`, sale && `${sale} sale`, cash && `${cash} cash`, feed && `${feed} feed`, use && `${use} milk-use`].filter(Boolean);
      if (parts.length === 0) return [];
      return [
        {
          key: "data.future-dated",
          ruleId: "data.future-dated",
          category: "INTEGRITY",
          severity: "HIGH",
          title: "Records are dated in the future",
          detail: `${parts.join(", ")} record(s) have a date after today. They will be missing from today's reports and show up later than they happened.`,
          suggestion: "Find them on the relevant list (sort by date) and correct the date.",
        },
      ];
    },
  },
  {
    id: "data.duplicate-milking",
    async run() {
      const rows = await prisma.$queryRaw<{ date: Date; tag: string | null; shift: string; n: number }[]>`
        SELECT r.date, c.tag, r.shift::text AS shift, COUNT(*)::int AS n
        FROM "MilkingRecord" r LEFT JOIN "Cow" c ON c.id = r."cowId"
        GROUP BY r.date, c.tag, r.shift, r."cowId"
        HAVING COUNT(*) > 1
        ORDER BY r.date DESC LIMIT 10`;
      if (rows.length === 0) return [];
      return [
        {
          key: "data.duplicate-milking",
          ruleId: "data.duplicate-milking",
          category: "INTEGRITY",
          severity: "HIGH",
          title: `${rows.length} cow-session${rows.length === 1 ? " has" : "s have"} more than one milking record`,
          detail: rows.slice(0, 6).map((r) => `Cow ${r.tag ?? "Group"} ${key(r.date)} ${r.shift.toLowerCase()} x${r.n}`).join("; ") + ". Production is double-counted for these.",
          suggestion: "Open Milking Entry for that day, edit the record to leave one value, or delete the duplicate.",
        },
      ];
    },
  },
  {
    id: "data.unknown-buyers",
    async run() {
      const [buyers, customers] = await Promise.all([
        prisma.milkSale.groupBy({ by: ["buyer"], _count: { _all: true }, _max: { date: true } }),
        prisma.customer.findMany({ select: { name: true } }),
      ]);
      const known = new Set(customers.map((c) => c.name.toLowerCase()));
      const unknown = buyers.filter((b) => b.buyer.trim() && !known.has(b.buyer.toLowerCase()));
      if (unknown.length === 0) return [];
      // History-loaded buyers (e.g. Engro) are expected; flag them softly. Anything entered normally is a problem.
      const real = await prisma.milkSale.groupBy({
        by: ["buyer"],
        where: { buyer: { in: unknown.map((u) => u.buyer) }, OR: [{ enteredBy: null }, { enteredBy: { not: BACKFILL } }] },
        _count: { _all: true },
      });
      return [
        {
          key: "data.unknown-buyers",
          ruleId: "data.unknown-buyers",
          category: "INTEGRITY",
          severity: real.length > 0 ? "MEDIUM" : "INFO",
          title: `${unknown.length} buyer name${unknown.length === 1 ? "" : "s"} on sales ${unknown.length === 1 ? "is" : "are"} not in the Customers list`,
          detail: unknown.map((u) => `${u.buyer} (${u._count._all} sales, last ${u._max.date ? key(u._max.date) : "-"})`).join("; "),
          suggestion: real.length > 0 ? "Sales must be under a registered customer so balances and statements work. Ask the Admin to add the customer or correct the name." : "These are from the loaded history (for example a past buyer that is no longer a customer). No action needed unless you want them as customers.",
        },
      ];
    },
  },
  {
    id: "data.feed-names",
    async run() {
      const [types, items] = await Promise.all([prisma.feedTransaction.groupBy({ by: ["feedType"], _count: { _all: true } }), prisma.feedItem.findMany({ select: { name: true } })]);
      const known = new Set(items.map((i) => i.name.toLowerCase()));
      const bad = types.filter((t) => !known.has(t.feedType.toLowerCase()));
      if (bad.length === 0) return [];
      return [
        {
          key: "data.feed-names",
          ruleId: "data.feed-names",
          category: "INTEGRITY",
          severity: "HIGH",
          title: `Feed entries use names that are not in Feed Master`,
          detail: bad.map((b) => `${b.feedType} (${b._count._all} entries)`).join("; ") + ". They will not appear in stock or the Feed Overview.",
          suggestion: "Add the feed to Feed Master or correct the entries.",
        },
      ];
    },
  },
  {
    id: "data.orphan-payments",
    async run() {
      const [unlinked, orphanCash] = await Promise.all([
        prisma.customerPayment.count({ where: { cashTransactionId: null } }),
        prisma.cashTransaction.count({ where: { category: "Milk Sale Payment", customerPayment: null } }),
      ]);
      if (unlinked + orphanCash === 0) return [];
      return [
        {
          key: "data.orphan-payments",
          ruleId: "data.orphan-payments",
          category: "INTEGRITY",
          severity: "MEDIUM",
          title: "Customer payments and the cash book do not match up",
          detail: `${unlinked} customer payment(s) have no cash entry; ${orphanCash} 'Milk Sale Payment' cash entr${orphanCash === 1 ? "y has" : "ies have"} no customer payment.`,
          suggestion: "Delete and re-enter the payment from Milk Sales so both sides are created together.",
        },
      ];
    },
  },
];
