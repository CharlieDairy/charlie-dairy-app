import { prisma } from "@/lib/prisma";

export type MonthlyPnl = {
  month: string; // "YYYY-MM"
  revenue: number;
  expense: number;
  net: number;
  revenueByCategory: Record<string, number>;
  expenseByCategory: Record<string, number>;
};

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Historical milk-sale revenue was migrated only into CashTransaction (as
// category "Cash sale proceed for Milk"); MilkSale is meant to fill only from
// entries logged going forward via Milk Sale Entry, so summing both here
// cannot double-count — EXCEPT for rows backfilled by
// scripts/deploy/backfill-milksale-from-cash.ts, which exist specifically to
// give MilkSale historical litres/buyer data and represent money that's
// already counted on the CashTransaction side. Those are excluded from
// revenue here to avoid counting the same cash twice.
const BACKFILL_MARKER = "Backfill (cash ledger)";

// Same double-count problem, same shape: a milk sale's revenue is recognized
// once, at sale time, via MilkSale.amount. When the customer later actually
// pays, recordCustomerPayment() (src/app/admin/reports/milk-sales/actions.ts)
// creates a CashTransaction so the cash movement is real and visible in the
// ledger/audit log -- but it must NOT also count as new revenue, or every
// paid sale would be counted twice. Excluded from the revenue sum here;
// still a real, queryable CashTransaction row everywhere else.
const CUSTOMER_PAYMENT_CATEGORY = "Milk Sale Payment";

// Before the app's Milk Sale Entry went live, milk revenue was booked only as
// lump-sum cash receipts under this category. From the first itemized sale in
// MilkSale onward, the same milk is in BOTH places -- the sale (accrual) and
// the cash receipt for it -- so the receipt is a customer payment, not new
// revenue. Without this, every month since cut-over counted its milk twice
// (confirmed on real data: Sept had 550,030 of itemized sales plus 317,930 of
// "Cash sale proceed for Milk" receipts dated Sept 1-18 for the same sales).
export const MILK_CASH_CATEGORY = "Cash sale proceed for Milk";

/** Date of the first itemized (non-backfill) milk sale, or null if none yet. */
export async function getMilkSalesCutover(): Promise<Date | null> {
  const first = await prisma.milkSale.findFirst({
    where: { NOT: { enteredBy: BACKFILL_MARKER } },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  return first?.date ?? null;
}

export async function getMonthlyPnl(): Promise<MonthlyPnl[]> {
  const [cash, sales, cutover] = await Promise.all([
    prisma.cashTransaction.findMany({ select: { date: true, category: true, amountIn: true, amountOut: true } }),
    prisma.milkSale.findMany({ where: { NOT: { enteredBy: BACKFILL_MARKER } }, select: { date: true, amount: true } }),
    getMilkSalesCutover(),
  ]);

  const months = new Map<string, MonthlyPnl>();
  const bucket = (date: Date) => {
    const key = monthKey(date);
    if (!months.has(key)) {
      months.set(key, { month: key, revenue: 0, expense: 0, net: 0, revenueByCategory: {}, expenseByCategory: {} });
    }
    return months.get(key)!;
  };

  for (const c of cash) {
    const m = bucket(c.date);
    const isMilkReceiptOfTrackedSale = c.category === MILK_CASH_CATEGORY && cutover !== null && c.date >= cutover;
    if (c.amountIn > 0 && c.category !== CUSTOMER_PAYMENT_CATEGORY && !isMilkReceiptOfTrackedSale) {
      m.revenue += c.amountIn;
      m.revenueByCategory[c.category] = (m.revenueByCategory[c.category] ?? 0) + c.amountIn;
    }
    if (c.amountOut > 0) {
      m.expense += c.amountOut;
      m.expenseByCategory[c.category] = (m.expenseByCategory[c.category] ?? 0) + c.amountOut;
    }
  }
  for (const s of sales) {
    const m = bucket(s.date);
    m.revenue += s.amount;
    m.revenueByCategory["Milk Sale (app entry)"] = (m.revenueByCategory["Milk Sale (app entry)"] ?? 0) + s.amount;
  }

  for (const m of months.values()) m.net = m.revenue - m.expense;
  return Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export type MonthlyCashFlow = { month: string; cashIn: number; cashOut: number; netCashFlow: number; cumulativeCash: number };

// Genuinely cash-basis: sums real CashTransaction movements directly, unlike
// getMonthlyPnl's revenue (which recognizes a MilkSale's full amount at sale
// time whether or not it's been paid). A sale made on credit is real
// accrual revenue but not yet real cash -- it belongs in P&L, not here. Once
// the customer actually pays, recordCustomerPayment() creates the
// CashTransaction that shows up in this sum, exactly when the cash moves.
export async function getMonthlyCashFlow(): Promise<MonthlyCashFlow[]> {
  const cash = await prisma.cashTransaction.findMany({ select: { date: true, amountIn: true, amountOut: true } });

  const months = new Map<string, { cashIn: number; cashOut: number }>();
  for (const c of cash) {
    const key = monthKey(c.date);
    if (!months.has(key)) months.set(key, { cashIn: 0, cashOut: 0 });
    const m = months.get(key)!;
    m.cashIn += c.amountIn;
    m.cashOut += c.amountOut;
  }

  let cumulative = 0;
  return Array.from(months.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, m]) => {
      const netCashFlow = m.cashIn - m.cashOut;
      cumulative += netCashFlow;
      return { month, cashIn: m.cashIn, cashOut: m.cashOut, netCashFlow, cumulativeCash: cumulative };
    });
}
