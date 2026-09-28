import { prisma } from "@/lib/prisma";
import { compare, monthRanges, type Comparison } from "@/lib/compare";

export type FeedTypeBalance = {
  feedType: string;
  balance: number;
  avgDailyConsumption: number; // OUT quantity / day, trailing 30 days
  daysRemaining: number | null; // null when there's no recent consumption to project from
  costThisMonth: number;
  reorderLevel: number | null; // from Feed Master (FeedItem), matched by name
  lowStock: boolean;
};

export type FeedOverview = {
  balances: FeedTypeBalance[];
  totalBalance: number;
  quantityOut: Comparison; // total OUT quantity, this month vs last
  costOut: Comparison; // total OUT cost, this month vs last
  lowStockCount: number;
};

// Feed Entry only ever recorded individual in/out transactions -- there was
// no running stock balance or consumption rate anywhere, so you couldn't
// tell what's on hand or when you'd run out without adding up the entry
// list by hand. This derives all of that from the existing FeedTransaction
// rows (no schema change): balance is a running IN-minus-OUT per feed type,
// "days remaining" projects the balance forward using the last 30 days'
// actual consumption rate, and cost/quantity trends use the same
// month-over-month comparison pattern as the other sections.
export async function getFeedOverview(referenceDate = new Date()): Promise<FeedOverview> {
  const { currentStart, nextStart, previousStart } = monthRanges(referenceDate);
  const trailing30Start = new Date(referenceDate.getTime() - 30 * 86_400_000);

  const [allTx, recentOut, currentMonthOut, previousMonthOut] = await Promise.all([
    prisma.feedTransaction.findMany({ select: { feedType: true, direction: true, quantity: true } }),
    prisma.feedTransaction.findMany({
      where: { direction: "OUT", date: { gte: trailing30Start, lte: referenceDate } },
      select: { feedType: true, quantity: true },
    }),
    prisma.feedTransaction.aggregate({
      where: { direction: "OUT", date: { gte: currentStart, lt: nextStart } },
      _sum: { quantity: true, cost: true },
    }),
    prisma.feedTransaction.aggregate({
      where: { direction: "OUT", date: { gte: previousStart, lt: currentStart } },
      _sum: { quantity: true, cost: true },
    }),
  ]);

  const costByTypeThisMonth = await prisma.feedTransaction.groupBy({
    by: ["feedType"],
    where: { direction: "OUT", date: { gte: currentStart, lt: nextStart } },
    _sum: { cost: true },
  });
  const costMap = new Map(costByTypeThisMonth.map((c) => [c.feedType, c._sum.cost ?? 0]));

  const feedItems = await prisma.feedItem.findMany({ select: { name: true, reorderLevel: true } });
  const reorderLevelMap = new Map(feedItems.map((f) => [f.name.toLowerCase(), f.reorderLevel]));

  const balanceMap = new Map<string, number>();
  for (const tx of allTx) {
    const delta = tx.direction === "IN" ? tx.quantity : -tx.quantity;
    balanceMap.set(tx.feedType, (balanceMap.get(tx.feedType) ?? 0) + delta);
  }

  const recentOutMap = new Map<string, number>();
  for (const tx of recentOut) {
    recentOutMap.set(tx.feedType, (recentOutMap.get(tx.feedType) ?? 0) + tx.quantity);
  }

  const balances: FeedTypeBalance[] = Array.from(balanceMap.entries())
    .map(([feedType, balance]) => {
      const avgDailyConsumption = (recentOutMap.get(feedType) ?? 0) / 30;
      const reorderLevel = reorderLevelMap.get(feedType.toLowerCase()) ?? null;
      return {
        feedType,
        balance,
        avgDailyConsumption,
        daysRemaining: avgDailyConsumption > 0 ? balance / avgDailyConsumption : null,
        costThisMonth: costMap.get(feedType) ?? 0,
        reorderLevel,
        lowStock: reorderLevel !== null && balance <= reorderLevel,
      };
    })
    .sort((a, b) => a.feedType.localeCompare(b.feedType));

  return {
    balances,
    totalBalance: balances.reduce((sum, b) => sum + b.balance, 0),
    quantityOut: compare(currentMonthOut._sum.quantity ?? 0, previousMonthOut._sum.quantity ?? 0),
    costOut: compare(currentMonthOut._sum.cost ?? 0, previousMonthOut._sum.cost ?? 0),
    lowStockCount: balances.filter((b) => b.lowStock).length,
  };
}
