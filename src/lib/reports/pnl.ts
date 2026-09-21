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

// Historical data was migrated only into CashTransaction (revenue side included,
// e.g. "Cash sale proceed for Milk"); MilkSale starts empty and only fills as
// entries are logged going forward, so summing both here cannot double-count.
export async function getMonthlyPnl(): Promise<MonthlyPnl[]> {
  const [cash, sales] = await Promise.all([
    prisma.cashTransaction.findMany({ select: { date: true, category: true, amountIn: true, amountOut: true } }),
    prisma.milkSale.findMany({ select: { date: true, amount: true } }),
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
    if (c.amountIn > 0) {
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
