import { getDashboardSummary } from "@/lib/reports/dashboard";
import {
  getAvailableYears,
  getBestMonth,
  getHerdComposition,
  getMonthlyMilkTrend,
  getTopLowProducers,
} from "@/lib/reports/milkAnalytics";
import { getLabelMap } from "@/lib/masterData";
import { formatRs, formatPct } from "@/lib/format";
import StatCard from "@/components/StatCard";
import YearlyMilkChart from "./YearlyMilkChart";
import HerdCompositionChart from "./HerdCompositionChart";
import YearSelector from "./YearSelector";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await getAvailableYears();
  const year = params.year && availableYears.includes(Number(params.year))
    ? Number(params.year)
    : availableYears[0];

  const [s, trend, producers, statusLabels] = await Promise.all([
    getDashboardSummary(),
    getMonthlyMilkTrend(year),
    getTopLowProducers(year),
    getLabelMap("COW_STATUS"),
  ]);
  const composition = await getHerdComposition(statusLabels);
  const bestMonth = getBestMonth(trend);

  const milkingCount = composition.find((c) => c.status === "MILKING")?.count ?? 0;
  const nonMilkingCount = composition
    .filter((c) => c.status !== "MILKING" && c.status !== "SOLD" && c.status !== "DEAD")
    .reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={formatRs(s.totalRevenue)} />
        <StatCard label="Total Expense" value={formatRs(s.totalExpense)} />
        <StatCard label="Net Income" value={formatRs(s.netIncome)} tone={s.netIncome >= 0 ? "positive" : "negative"} />
        <StatCard label="Net Margin" value={formatPct(s.netMargin)} tone={s.netMargin >= 0 ? "positive" : "negative"} />
        <StatCard label="Closing Cash (cumulative)" value={formatRs(s.closingCash)} tone={s.closingCash >= 0 ? "positive" : "negative"} />
        <StatCard label="Active Herd Size" value={s.activeHerdSize.toString()} />
        <StatCard label="Total Milk Recorded" value={`${Math.round(s.totalMilkLitres).toLocaleString()} L`} />
        <StatCard label="Net Capital Raised" value={formatRs(s.capitalRaised)} />
      </div>
      <p className="text-sm text-neutral-500">
        Figures are computed live from recorded cash transactions and milking records — not hand-maintained.
        Capital Raised covers all partner ledger entries (multiple ventures); see the Capital Ledger page to filter by venture.
      </p>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-neutral-900">Milk Production — {year}</h2>
          <YearSelector years={availableYears} selected={year} />
        </div>
        {bestMonth ? (
          <p className="text-sm text-neutral-500 mb-2">
            Best month: <span className="font-medium text-green-700">{bestMonth.monthLabel}</span> with{" "}
            {bestMonth.litres.toLocaleString()} L
          </p>
        ) : (
          <p className="text-sm text-neutral-400 mb-2">No milking records for {year} yet.</p>
        )}
        <YearlyMilkChart data={trend} bestMonth={bestMonth?.monthLabel ?? null} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <h2 className="font-semibold text-neutral-900 mb-1">Herd Composition</h2>
          <p className="text-sm text-neutral-500 mb-2">
            <span className="font-medium text-green-700">{milkingCount} milking</span> ·{" "}
            <span className="font-medium text-neutral-700">{nonMilkingCount} non-milking</span>
          </p>
          <HerdCompositionChart data={composition} />
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <h2 className="font-semibold text-neutral-900 mb-1">Producer Performance — {year}</h2>
          <p className="text-xs text-neutral-400 mb-3">Ranked by average litres/day; needs 5+ recorded days to qualify.</p>
          {producers.top.length === 0 ? (
            <p className="text-sm text-neutral-400">Not enough recorded milking days yet for {year}.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-green-700 uppercase tracking-wide mb-2">Top Producers</p>
                <table className="w-full text-sm">
                  <tbody>
                    {producers.top.map((p) => (
                      <tr key={p.cowId} className="border-t border-neutral-100">
                        <td className="py-1 font-medium">{p.tag}</td>
                        <td className="py-1 text-right text-neutral-600">{p.avgPerDay} L/d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-2">Low Producers</p>
                <table className="w-full text-sm">
                  <tbody>
                    {producers.low.map((p) => (
                      <tr key={p.cowId} className="border-t border-neutral-100">
                        <td className="py-1 font-medium">{p.tag}</td>
                        <td className="py-1 text-right text-neutral-600">{p.avgPerDay} L/d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
