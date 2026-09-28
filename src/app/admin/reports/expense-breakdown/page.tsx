import StatCard from "@/components/StatCard";
import { formatRs } from "@/lib/format";
import { getExpenseBreakdown } from "@/lib/reports/expenses";
import type { PeriodKey } from "@/lib/reports/herd";
import PeriodSelect from "./PeriodSelect";

export default async function ExpenseBreakdownPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period: PeriodKey = (["day", "week", "month", "year", "all"] as const).includes(params.period as PeriodKey)
    ? (params.period as PeriodKey)
    : "month";

  const { total, categories } = await getExpenseBreakdown(period);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Expense Breakdown</h1>
        <PeriodSelect period={period} />
      </div>
      <p className="text-sm text-neutral-500 max-w-2xl">
        Cash spent out, grouped by category — the same categories used on Cash Entry.
      </p>

      <div className="max-w-xs">
        <StatCard label="Total Expense" value={formatRs(total)} />
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Category</th>
              <th className="text-right px-3 py-2 font-medium text-neutral-600">Amount</th>
              <th className="text-right px-3 py-2 font-medium text-neutral-600">% of Total</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600 w-1/3">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.category} className="border-t border-neutral-100">
                <td className="px-3 py-2">{c.category}</td>
                <td className="px-3 py-2 text-right font-medium">{formatRs(c.amount)}</td>
                <td className="px-3 py-2 text-right text-neutral-500">{c.pctOfTotal.toFixed(1)}%</td>
                <td className="px-3 py-2">
                  <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-600 rounded-full" style={{ width: `${c.pctOfTotal}%` }} />
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-neutral-400">No expenses recorded in this period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
