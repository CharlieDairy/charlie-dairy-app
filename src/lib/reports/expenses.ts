import { prisma } from "@/lib/prisma";
import { CLASS_LABEL, classifyCash, netOf, type CashClassKey } from "@/lib/accounting/cashClass";
import { periodRange, type PeriodKey } from "./herd";

export type ExpenseCategoryRow = { category: string; amount: number; pctOfTotal: number };
export type ExpenseBreakdown = {
  /** Operating costs only. */
  total: number;
  categories: ExpenseCategoryRow[];
  /** Money that went out but is NOT an operating cost (capital spending, to partners, needs review), shown so nothing is hidden. */
  notExpense: { label: string; amount: number }[];
};

export async function getExpenseBreakdown(period: PeriodKey = "month", from?: string, to?: string): Promise<ExpenseBreakdown> {
  const range = periodRange(period, new Date(), from, to);
  const rows = await prisma.cashTransaction.findMany({
    where: { date: { gte: range.start, lt: range.end }, amountOut: { gt: 0 } },
    select: { category: true, amountIn: true, amountOut: true, remark: true, accountClass: true },
  });

  const byCategory = new Map<string, number>();
  const other = new Map<CashClassKey, number>();
  for (const r of rows) {
    const cls = classifyCash(r);
    if (cls === "OPEX") byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + netOf(cls, r.amountIn, r.amountOut));
    else if (cls === "CAPEX" || cls === "PARTNER_OUT" || cls === "REVIEW") other.set(cls, (other.get(cls) ?? 0) + r.amountOut);
  }

  const withAmount = [...byCategory.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const total = withAmount.reduce((n, r) => n + r.amount, 0);
  const categories = withAmount.map((r) => ({ ...r, pctOfTotal: total > 0 ? (r.amount / total) * 100 : 0 }));
  const notExpense = [...other.entries()].map(([k, amount]) => ({ label: CLASS_LABEL[k], amount })).filter((x) => x.amount > 0);

  return { total, categories, notExpense };
}
