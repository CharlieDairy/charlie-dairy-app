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

export async function getMonthlyPnl(): Promise<MonthlyPnl[]> {
  const [cash, sales] = await Promise.all([
    prisma.cashTransaction.findMany({ select: { date: true, category: true, amountIn: true, amountOut: true } }),
    prisma.milkSale.findMany({ where: { NOT: { enteredBy: BACKFILL_MARKER } }, select: { date: true, amount: true } }),
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
    if (c.amountIn > 0 && c.category !== CUSTOMER_PAYMENT_CATEGORY) {
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

export type MonthlyCashFlow = { month: string; netCashFlow: number; cumulativeCash: number };

export async function getMonthlyCashFlow(): Promise<MonthlyCashFlow[]> {
  const monthly = await getMonthlyPnl();
  let cumulative = 0;
  return monthly.map((m) => {
    cumulative += m.net;
    return { month: m.month, netCashFlow: m.net, cumulativeCash: cumulative };
  });
}
