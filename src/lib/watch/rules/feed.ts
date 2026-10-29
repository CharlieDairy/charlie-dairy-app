import { prisma } from "@/lib/prisma";
import { type FindingDraft, type Rule, addDays, key } from "../types";

async function balances() {
  const rows = await prisma.feedTransaction.groupBy({ by: ["feedType", "direction"], _sum: { quantity: true } });
  const bal = new Map<string, number>();
  for (const r of rows) bal.set(r.feedType, (bal.get(r.feedType) ?? 0) + (r.direction === "IN" ? 1 : -1) * (r._sum.quantity ?? 0));
  return bal;
}

export const feedRules: Rule[] = [
  {
    id: "feed.negative-stock",
    async run() {
      const bal = await balances();
      const out: FindingDraft[] = [];
      for (const [feed, qty] of bal) {
        if (qty >= -0.5) continue;
        const grown = feed.toLowerCase() === "fodder";
        out.push({
          key: `feed.negative-stock.${feed.toLowerCase()}`,
          ruleId: "feed.negative-stock",
          category: "FEED",
          severity: grown ? "LOW" : "HIGH",
          title: `${feed} stock is negative (${Math.round(qty).toLocaleString()} kg)`,
          detail: grown
            ? "More fodder has been issued than ever received. Fodder is grown on the farm and has no incoming entries, so it will always show negative."
            : `More ${feed} has been issued than was ever recorded as received, so some purchases or the opening stock are missing.`,
          suggestion: grown ? "Treat Fodder as 'not stocked' (see the app-gap note), or enter the farm's harvest as incoming stock." : `Enter the missing ${feed} purchases or an opening-stock entry on Feed Entry (Admin: Bulk Data).`,
          metric: { feed, balance: qty },
        });
      }
      return out;
    },
  },
  {
    id: "feed.days-left",
    async run({ today }) {
      const [bal, out14, items] = await Promise.all([
        balances(),
        prisma.feedTransaction.groupBy({ by: ["feedType"], where: { direction: "OUT", date: { gte: addDays(today, -14), lt: today } }, _sum: { quantity: true } }),
        prisma.feedItem.findMany({ where: { active: true }, select: { name: true, reorderLevel: true } }),
      ]);
      const perDay = new Map(out14.map((o) => [o.feedType, (o._sum.quantity ?? 0) / 14]));
      const res: FindingDraft[] = [];
      for (const it of items) {
        const qty = bal.get(it.name) ?? 0;
        const use = perDay.get(it.name) ?? 0;
        if (qty <= 0 || use <= 0) continue;
        const days = qty / use;
        const below = it.reorderLevel != null && qty < it.reorderLevel;
        if (days >= 14 && !below) continue;
        res.push({
          key: `feed.days-left.${it.name.toLowerCase()}`,
          ruleId: "feed.days-left",
          category: "FEED",
          severity: days < 7 ? "HIGH" : "MEDIUM",
          title: `${it.name} will run out in about ${Math.floor(days)} days`,
          detail: `${Math.round(qty).toLocaleString()} kg left, using about ${Math.round(use).toLocaleString()} kg a day over the last 2 weeks${below ? `, and below the reorder level of ${it.reorderLevel}` : ""}.`,
          suggestion: `Arrange the next ${it.name} purchase before ${key(addDays(today, Math.max(0, Math.floor(days) - 3)))}.`,
          metric: { feed: it.name, balance: qty, perDay: use, daysLeft: Math.round(days * 10) / 10 },
        });
      }
      return res;
    },
  },
  {
    id: "feed.uncosted",
    async run({ today }) {
      const rows = await prisma.feedTransaction.groupBy({
        by: ["feedType"],
        where: { direction: "OUT", date: { gte: addDays(today, -90), lt: addDays(today, 1) }, OR: [{ cost: null }, { cost: 0 }] },
        _sum: { quantity: true },
        _count: { _all: true },
      });
      const total = rows.reduce((n, r) => n + r._count._all, 0);
      if (total === 0) return [];
      return [
        {
          key: "feed.uncosted",
          ruleId: "feed.uncosted",
          category: "FEED",
          severity: "MEDIUM",
          title: `${total} feed issue entries in the last 90 days have no cost`,
          detail: rows.map((r) => `${r.feedType}: ${r._count._all} entries, ${Math.round(r._sum.quantity ?? 0).toLocaleString()} kg`).join("; ") + ". Feed cost per litre and the monthly feed cost are understated by this feed.",
          suggestion: "Feed is costed first-in, first-out from the purchase rates, so enter the rate paid on this feed's purchases (Feed & Inventory, Admin). Every issue is then costed automatically.",
          metric: { feeds: rows.map((r) => ({ feed: r.feedType, entries: r._count._all, kg: r._sum.quantity })) },
        },
      ];
    },
  },
  {
    // First-in, first-out costs an issue from the rate of the purchase it came from, so a purchase with no rate leaves the
    // cost of everything taken from it as an estimate.
    id: "feed.unrated-receipts",
    async run({ today }) {
      const rows = await prisma.feedTransaction.groupBy({
        by: ["feedType"],
        where: { direction: "IN", date: { gte: addDays(today, -365), lt: addDays(today, 1) }, OR: [{ rate: null }, { rate: 0 }] },
        _sum: { quantity: true },
        _count: { _all: true },
      });
      const total = rows.reduce((n, r) => n + r._count._all, 0);
      if (total === 0) return [];
      return [
        {
          key: "feed.unrated-receipts",
          ruleId: "feed.unrated-receipts",
          category: "FEED",
          severity: "MEDIUM",
          title: `${total} feed purchase${total === 1 ? "" : "s"} in the last year ${total === 1 ? "has" : "have"} no rate`,
          detail: rows.map((r) => `${r.feedType}: ${r._count._all} purchase${r._count._all === 1 ? "" : "s"}, ${Math.round(r._sum.quantity ?? 0).toLocaleString()} units`).join("; ") + ". Feed is costed first-in, first-out from the purchase rates, so anything used from these purchases is costed at an estimate and the value of the stock left is not exact.",
          suggestion: "Open the feed, edit each purchase and enter the rate you paid per unit (the supplier bill or the cash book shows it). Every issue after it is re-costed automatically.",
          metric: { feeds: rows.map((r) => ({ feed: r.feedType, purchases: r._count._all, quantity: r._sum.quantity })) },
        },
      ];
    },
  },
];
