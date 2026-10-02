import { prisma } from "@/lib/prisma";
import { periodRange, type PeriodKey } from "./herd";

export type ExpenseCategoryRow = { category: string; amount: number; pctOfTotal: number };
export type ExpenseBreakdown = { total: number; categories: ExpenseCategoryRow[] };

export async function getExpenseBreakdown(period: PeriodKey = "month", from?: string, to?: string): Promise<ExpenseBreakdown> {
  const range = periodRange(period, new Date(), from, to);
  const rows = await prisma.cashTransaction.groupBy({
    by: ["category"],
    where: { date: { gte: range.start, lt: range.end } },
    _sum: { amountOut: true },
  });

  const withAmount = rows
    .map((r) => ({ category: r.category, amount: r._sum.amountOut ?? 0 }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const total = withAmount.reduce((n, r) => n + r.amount, 0);
  const categories = withAmount.map((r) => ({ ...r, pctOfTotal: total > 0 ? (r.amount / total) * 100 : 0 }));

  return { total, categories };
}
