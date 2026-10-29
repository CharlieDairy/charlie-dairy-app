import { prisma } from "@/lib/prisma";
import { compare, monthRanges, type Comparison } from "@/lib/compare";
import { runFifo, type FifoTx } from "@/lib/feedFifo";

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


// ---------------------------------------------------------------------------
// Period report for the Feed Overview page: per feed, the opening balance
// (everything before the period), what came IN and went OUT inside it, the
// closing balance, and the averages -- plus, for one selected feed, the
// transaction ledger with a running balance.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

export type FeedPeriodRow = {
  feedType: string;
  unit: string | null; // from Feed Master, null for a legacy name not in the master
  inMaster: boolean;
  opening: number;
  inQty: number;
  outQty: number;
  closing: number;
  avgDailyUse: number; // OUT quantity / days in the period
  avgRate: number | null; // average cost per unit of what was used in the period (first-in, first-out)
  outCost: number; // first-in, first-out cost of the feed used in the period
  openingValue: number; // value of the stock at the start of the period
  purchaseValue: number; // purchases received in the period at their own rates
  closingValue: number; // value of the stock at the end of the period (the layers still on hand)
  closingAvgCost: number | null; // closingValue / closing balance
  estimatedUseQty: number; // quantity used in the period that was costed at a fallback rate
  unpricedUseQty: number; // quantity used in the period that could not be priced at all
  unratedPurchaseQty: number; // quantity received in the period with no purchase rate
  daysLeft: number | null; // closing balance / trailing-30-day average use
  reorderLevel: number | null;
  lowStock: boolean;
};

export type FeedLedgerLine = {
  id: string;
  date: string;
  direction: "IN" | "OUT";
  quantity: number;
  rate: number | null; // IN: purchase rate. OUT: the first-in, first-out cost per unit.
  cost: number | null; // first-in, first-out cost (OUT entries only)
  amount: number | null; // value of the line: purchase value for IN, first-in, first-out cost for OUT
  basis: "fifo" | "estimate" | "none" | null; // OUT only: costed from purchase rates, partly from a fallback, or not at all
  notes: string | null;
  enteredBy: string | null;
  balance: number; // running balance after this line
};

export type FeedLayerLine = {
  date: string;
  received: number;
  remaining: number;
  rate: number | null; // the purchase rate, null when none was recorded
  valueRate: number | null; // rate used to value what is left
  value: number;
};

export type FeedPeriodReport = {
  days: number;
  rows: FeedPeriodRow[];
  ledger: FeedLedgerLine[] | null; // only when a single feed is selected
  layers: FeedLayerLine[] | null; // stock still on hand at the end of the period, oldest first (single feed only)
};

export async function getFeedPeriodReport(range: { start: Date; end: Date }, feedType?: string): Promise<FeedPeriodReport> {
  const [items, tx] = await Promise.all([
    prisma.feedItem.findMany({ select: { name: true, unit: true, reorderLevel: true, active: true } }),
    prisma.feedTransaction.findMany({
      where: { date: { lt: range.end } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: { id: true, date: true, createdAt: true, feedType: true, direction: true, quantity: true, rate: true, cost: true, notes: true, enteredBy: true },
    }),
  ]);

  // First-in, first-out for every feed: once over everything up to the end of the period (issue costs and closing layers)
  // and once over everything before it (the opening value).
  const byFeed = new Map<string, FifoTx[]>();
  for (const t of tx) {
    const list = byFeed.get(t.feedType);
    const item: FifoTx = { id: t.id, date: t.date, createdAt: t.createdAt, direction: t.direction, quantity: t.quantity, rate: t.rate };
    if (list) list.push(item);
    else byFeed.set(t.feedType, [item]);
  }
  const fifoEnd = new Map(Array.from(byFeed, ([name, list]) => [name, runFifo(list)] as const));
  const fifoStart = new Map(Array.from(byFeed, ([name, list]) => [name, runFifo(list.filter((t) => t.date < range.start))] as const));

  const now = Date.now();
  const elapsedEnd = Math.min(range.end.getTime(), now + DAY_MS);
  const days = Math.max(1, Math.round((elapsedEnd - range.start.getTime()) / DAY_MS));
  const trailingStart = now - 30 * DAY_MS;

  type Acc = { opening: number; inQty: number; outQty: number; outCost: number; purchaseValue: number; estimatedUse: number; unpricedUse: number; unratedIn: number; recentOut: number };
  const acc = new Map<string, Acc>();
  const get = (name: string): Acc => {
    let a = acc.get(name);
    if (!a) acc.set(name, (a = { opening: 0, inQty: 0, outQty: 0, outCost: 0, purchaseValue: 0, estimatedUse: 0, unpricedUse: 0, unratedIn: 0, recentOut: 0 }));
    return a;
  };
  for (const item of items) if (item.active) get(item.name);

  for (const t of tx) {
    const a = get(t.feedType);
    const delta = t.direction === "IN" ? t.quantity : -t.quantity;
    if (t.date < range.start) {
      a.opening += delta;
    } else if (t.direction === "IN") {
      a.inQty += t.quantity;
      if (t.rate !== null && t.rate > 0) a.purchaseValue += t.rate * t.quantity;
      else a.unratedIn += t.quantity;
    } else {
      const issue = fifoEnd.get(t.feedType)?.issues.get(t.id);
      a.outQty += t.quantity;
      a.outCost += issue?.cost ?? 0;
      a.estimatedUse += issue?.estimatedQty ?? 0;
      a.unpricedUse += issue?.unpricedQty ?? 0;
    }
    if (t.direction === "OUT" && t.date.getTime() >= trailingStart) a.recentOut += t.quantity;
  }

  const itemByName = new Map(items.map((i) => [i.name, i]));
  const rows: FeedPeriodRow[] = Array.from(acc.entries())
    .map(([name, a]) => {
      const item = itemByName.get(name);
      const closing = a.opening + a.inQty - a.outQty;
      const recentDaily = a.recentOut / 30;
      const reorderLevel = item?.reorderLevel ?? null;
      const closingValue = fifoEnd.get(name)?.stockValue ?? 0;
      return {
        feedType: name,
        unit: item?.unit ?? null,
        inMaster: !!item,
        opening: a.opening,
        inQty: a.inQty,
        outQty: a.outQty,
        closing,
        avgDailyUse: a.outQty / days,
        avgRate: a.outQty > 0 && a.outCost > 0 ? a.outCost / a.outQty : null,
        outCost: a.outCost,
        openingValue: fifoStart.get(name)?.stockValue ?? 0,
        purchaseValue: Math.round(a.purchaseValue * 100) / 100,
        closingValue,
        closingAvgCost: closing > 0 && closingValue > 0 ? closingValue / closing : null,
        estimatedUseQty: a.estimatedUse,
        unpricedUseQty: a.unpricedUse,
        unratedPurchaseQty: a.unratedIn,
        daysLeft: recentDaily > 0 && closing > 0 ? closing / recentDaily : null,
        reorderLevel,
        lowStock: reorderLevel !== null && closing <= reorderLevel,
      };
    })
    .sort((x, y) => x.feedType.localeCompare(y.feedType));

  let ledger: FeedLedgerLine[] | null = null;
  let layers: FeedLayerLine[] | null = null;
  if (feedType) {
    const selected = rows.find((r) => r.feedType === feedType);
    const issues = fifoEnd.get(feedType)?.issues;
    let balance = selected?.opening ?? 0;
    ledger = [];
    for (const t of tx) {
      if (t.feedType !== feedType || t.date < range.start) continue;
      balance += t.direction === "IN" ? t.quantity : -t.quantity;
      const issue = t.direction === "OUT" ? issues?.get(t.id) : undefined;
      const cost = issue?.cost ?? null;
      const amount = t.direction === "IN" ? (t.rate !== null ? Math.round(t.rate * t.quantity * 100) / 100 : null) : cost;
      ledger.push({
        id: t.id,
        date: t.date.toISOString().slice(0, 10),
        direction: t.direction,
        quantity: t.quantity,
        rate: t.direction === "IN" ? t.rate : cost !== null && t.quantity > 0 ? cost / t.quantity : null,
        cost,
        amount,
        basis: !issue ? null : issue.cost === null ? "none" : issue.estimatedQty > 0 ? "estimate" : "fifo",
        notes: t.notes,
        enteredBy: t.enteredBy,
        balance,
      });
    }
    layers = (fifoEnd.get(feedType)?.layers ?? []).map((l) => ({
      date: l.date.toISOString().slice(0, 10),
      received: l.quantity,
      remaining: l.remaining,
      rate: l.rate,
      valueRate: l.valueRate,
      value: Math.round(l.remaining * (l.valueRate ?? 0) * 100) / 100,
    }));
  }

  return { days, rows, ledger, layers };
}