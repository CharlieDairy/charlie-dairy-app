import { prisma } from "@/lib/prisma";
import { CASH_CLASSES, INCOME_CLASSES, classifyCash, netOf, type CashClassKey } from "@/lib/accounting/cashClass";
import { APP_FEED_CATEGORY, APP_MILK_CATEGORY, NO_APP_BOOKS, coveredByApp, loadAppBooks } from "./appBooks";

// The farm's accounts are kept on a CASH basis: income is counted when the money
// is received and cost when it is paid. Every Cash Register entry carries an
// accounting class (see accounting/cashClass.ts), and that class - not the raw
// category - decides where it appears:
//   revenue  = milk sales + animal & calf sales + other income
//   expense  = operating costs
//   NOT profit or loss: capital spending, money from / to partners, opening balance
// Exception, from the day the app began itemising milk sales (appBooks.ts): milk
// is counted when BILLED and feed when USED from stock, straight from the app's
// own records, so they flow the day they are entered. The Cash Register copies of
// those two (customer payments, feed purchases) are then left out, which is what
// keeps every rupee counted once. Before that day the cash book is unchanged.

export type MonthlyPnl = {
  month: string; // "YYYY-MM"
  revenue: number;
  expense: number;
  net: number;
  revenueByCategory: Record<string, number>;
  expenseByCategory: Record<string, number>;
  /** Net by accounting class (money in minus out for income, out minus in for costs). */
  byClass: Record<CashClassKey, number>;
  /** Operating profit from milk only: milk sales minus operating cost. */
  milkNet: number;
};

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

const emptyClasses = (): Record<CashClassKey, number> => Object.fromEntries(CASH_CLASSES.map((c) => [c, 0])) as Record<CashClassKey, number>;

// Kept for the report that matches milk receipts to customers (see balance sheet / customer payments).
export const MILK_CASH_CATEGORY = "Cash sale proceed for Milk";

/** Date of the first itemized (non-backfill) milk sale, or null if none yet. */
export async function getMilkSalesCutover(): Promise<Date | null> {
  const first = await prisma.milkSale.findFirst({
    where: { OR: [{ enteredBy: null }, { enteredBy: { not: "Backfill (cash ledger)" } }] },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  return first?.date ?? null;
}

/** `cashOnly` keeps the pure cash-book basis (the balance sheet needs it); otherwise milk billed and feed used come from the app. */
export async function getMonthlyPnl(opts: { cashOnly?: boolean } = {}): Promise<MonthlyPnl[]> {
  const [cash, app] = await Promise.all([
    prisma.cashTransaction.findMany({
      select: { id: true, date: true, category: true, amountIn: true, amountOut: true, remark: true, accountClass: true },
    }),
    opts.cashOnly ? Promise.resolve(NO_APP_BOOKS) : loadAppBooks(),
  ]);

  const months = new Map<string, MonthlyPnl>();
  const bucket = (date: Date) => {
    const key = monthKey(date);
    let m = months.get(key);
    if (!m) {
      m = { month: key, revenue: 0, expense: 0, net: 0, revenueByCategory: {}, expenseByCategory: {}, byClass: emptyClasses(), milkNet: 0 };
      months.set(key, m);
    }
    return m;
  };

  for (const c of cash) {
    const cls = classifyCash(c);
    if (coveredByApp(app, c, cls)) continue; // the app's own records count this one (see appBooks.ts)
    const m = bucket(c.date);
    const amt = netOf(cls, c.amountIn, c.amountOut);
    m.byClass[cls] += amt;
    if (INCOME_CLASSES.includes(cls)) {
      m.revenueByCategory[c.category] = (m.revenueByCategory[c.category] ?? 0) + amt;
    } else if (cls === "OPEX") {
      m.expenseByCategory[c.category] = (m.expenseByCategory[c.category] ?? 0) + amt;
    }
  }
  // Milk billed and feed used, straight from the app, from the day it began itemising sales.
  for (const s of app.milk) {
    const m = bucket(s.date);
    m.byClass.MILK_SALES += s.amount;
    m.revenueByCategory[APP_MILK_CATEGORY] = (m.revenueByCategory[APP_MILK_CATEGORY] ?? 0) + s.amount;
  }
  for (const f of app.feedUsed) {
    const m = bucket(f.date);
    m.byClass.OPEX += f.cost;
    m.expenseByCategory[APP_FEED_CATEGORY] = (m.expenseByCategory[APP_FEED_CATEGORY] ?? 0) + f.cost;
  }

  for (const m of months.values()) {
    m.revenue = m.byClass.MILK_SALES + m.byClass.LIVESTOCK_SALES + m.byClass.OTHER_INCOME;
    m.expense = m.byClass.OPEX;
    m.net = m.revenue - m.expense;
    m.milkNet = m.byClass.MILK_SALES - m.byClass.OPEX;
  }
  return Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export type MonthlyCashFlow = {
  month: string;
  cashIn: number;
  cashOut: number;
  netCashFlow: number;
  cumulativeCash: number;
  /** Money moved by what it was for. Operating = income minus operating cost; investing = capital spending; financing = partners. */
  operating: number;
  investing: number;
  financing: number;
  /** Money moved between the farm's own books (e.g. bank to petty cash): nets to about zero overall. */
  transfers: number;
  needsReview: number;
};

// Sums the real Cash Register movements and splits each month by purpose, the
// standard cash-flow layout: operating (running the farm incl. animal sales),
// investing (capital spending) and financing (money from / to the partners).
export async function getMonthlyCashFlow(): Promise<MonthlyCashFlow[]> {
  const cash = await prisma.cashTransaction.findMany({
    select: { date: true, category: true, amountIn: true, amountOut: true, remark: true, accountClass: true },
  });

  const months = new Map<string, Omit<MonthlyCashFlow, "month" | "netCashFlow" | "cumulativeCash">>();
  for (const c of cash) {
    const key = monthKey(c.date);
    let m = months.get(key);
    if (!m) {
      m = { cashIn: 0, cashOut: 0, operating: 0, investing: 0, financing: 0, transfers: 0, needsReview: 0 };
      months.set(key, m);
    }
    const net = c.amountIn - c.amountOut;
    m.cashIn += c.amountIn;
    m.cashOut += c.amountOut;
    const cls = classifyCash(c);
    if (cls === "CAPEX") m.investing += net;
    else if (cls === "PARTNER_IN" || cls === "PARTNER_OUT") m.financing += net;
    else if (cls === "TRANSFER") m.transfers += net;
    else if (cls === "REVIEW") m.needsReview += net;
    else if (cls !== "OPENING") m.operating += net;
  }

  let cumulative = 0;
  return Array.from(months.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, m]) => {
      const netCashFlow = m.cashIn - m.cashOut;
      cumulative += netCashFlow;
      return { month, ...m, netCashFlow, cumulativeCash: cumulative };
    });
}
