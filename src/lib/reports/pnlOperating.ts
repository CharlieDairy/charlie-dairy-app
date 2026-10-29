// The operating view of the P&L: what the farm earns and spends just from running it. Animal and calf sales are left out
// of revenue; every operating cost stays in. Capital spending and partner money are not costs in either view.
// Pure, so it is tested; the full statement (which includes animal and calf sales) is untouched.

import type { MonthlyPnl } from "@/lib/reports/pnl";
import { isFeedCategory } from "@/lib/accounting/cashClass";

type Month = Pick<MonthlyPnl, "byClass" | "expense" | "expenseByCategory">;

export type OperatingTotals = {
  milkSales: number;
  otherIncome: number;
  /** milk sales + other income, without animal and calf sales */
  revenue: number;
  /** every operating cost: feedCost + opex */
  cost: number;
  /** all feed bought (Opex Feed, Feed supliment) */
  feedCost: number;
  /** all other operating cost (OPEX): salaries and advances, fuel, medical, A.I., vaccination and every other expense */
  opex: number;
  /** revenue minus cost */
  net: number;
  /** animal and calf sales that were left out of the revenue above */
  animalSalesExcluded: number;
  /** operating profit as a share of operating revenue, null when there is no revenue */
  marginPct: number | null;
};

export function operatingTotals(months: Month[]): OperatingTotals {
  const milkSales = months.reduce((n, m) => n + m.byClass.MILK_SALES, 0);
  const otherIncome = months.reduce((n, m) => n + m.byClass.OTHER_INCOME, 0);
  const cost = months.reduce((n, m) => n + m.expense, 0);
  const animalSalesExcluded = months.reduce((n, m) => n + m.byClass.LIVESTOCK_SALES, 0);
  const feedCost = months.reduce((n, m) => n + Object.entries(m.expenseByCategory).reduce((s, [cat, amt]) => s + (isFeedCategory(cat) ? amt : 0), 0), 0);
  const revenue = milkSales + otherIncome;
  const net = revenue - cost;
  return { milkSales, otherIncome, revenue, cost, feedCost, opex: cost - feedCost, net, animalSalesExcluded, marginPct: revenue > 0 ? (net / revenue) * 100 : null };
}
