import { getDashboardSummary, getTodaySnapshot } from "@/lib/reports/dashboard";
import {
  getAvailableYears,
  getBestMonth,
  getHerdComposition,
  getMonthlyMilkTrend,
  getProductionVsSold,
  getSalesSummary,
  getTopLowProducers,
} from "@/lib/reports/milkAnalytics";
import { getBreedingKpis } from "@/lib/reports/breeding";
import { getLabelMap } from "@/lib/masterData";
import { formatRs, formatPct } from "@/lib/format";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import YearlyMilkChart from "./YearlyMilkChart";
import HerdCompositionChart from "./HerdCompositionChart";
import ProductionVsSoldChart from "./ProductionVsSoldChart";
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

  const [s, today, trend, producers, statusLabels, sales, productionVsSold, breedingKpis] = await Promise.all([
    getDashboardSummary(),
    getTodaySnapshot(),
    getMonthlyMilkTrend(year),
    getTopLowProducers(year),
    getLabelMap("COW_STATUS"),
    getSalesSummary(year),
    getProductionVsSold(year),
    getBreedingKpis(),
  ]);
  const composition = await getHerdComposition(statusLabels);
  const bestMonth = getBestMonth(trend);

  const countFor = (status: string) => composition.find((c) => c.status === status)?.count ?? 0;
  const milkingCount = countFor("MILKING");
  const nonMilkingCount = composition
    .filter((c) => c.status !== "MILKING" && c.status !== "SOLD" && c.status !== "DEAD")
    .reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        actions={
          <>
            <label className="text-sm text-text-muted">Year</label>
            <YearSelector years={availableYears} selected={year} />
          </>
        }
      />

      {/* Level 1 — critical operational KPIs, always "as of today" (or the
          most recent day with an entry, clearly labeled) */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-text">
            Today {!today.isToday && <span className="text-xs font-normal text-text-muted">(no entry yet today — showing {today.date})</span>}
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Milk Today" value={`${today.milkLitres.toLocaleString()} L`} />
          <StatCard label="Milk / Cow" value={`${today.milkPerCow.toFixed(1)} L`} />
          <StatCard label="Revenue" value={formatRs(today.revenue)} tone="positive" />
          <StatCard
            label="Estimated Margin"
            value={formatRs(today.estimatedMargin)}
            tone={today.estimatedMargin >= 0 ? "positive" : "negative"}
          />
        </div>
      </Card>

      {/* Level 2 — operational status strip, scan in one glance */}
      <div className="flex flex-wrap gap-2">
        <Badge tone="success">{milkingCount} Milking</Badge>
        <Badge tone="info">{breedingKpis.pregnantCount} Pregnant</Badge>
        <Badge tone="neutral">{countFor("DRY")} Dry</Badge>
        <Badge tone="neutral">{countFor("HEIFER")} Heifers</Badge>
        <Badge tone="neutral">{countFor("CALF")} Calves</Badge>
        {breedingKpis.dueNext30Days > 0 && <Badge tone="warning">{breedingKpis.dueNext30Days} Due to Calve (30d)</Badge>}
      </div>

      {/* Level 3 — trends and detail */}
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
        <h2 className="font-semibold text-neutral-900 mb-2">Milk Sales — {year}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Litres Sold" value={`${sales.totalLitresSold.toLocaleString()} L`} />
          <StatCard label="Revenue" value={formatRs(sales.totalRsSold)} tone="positive" />
          <StatCard label="Customers (identified)" value={sales.customerCount.toString()} />
          <StatCard label="Sale Records" value={sales.recordCount.toString()} />
        </div>
        {sales.recordCount > sales.recordsWithQuantity && (
          <p className="text-xs text-neutral-400 mt-2">
            {sales.recordCount - sales.recordsWithQuantity} of {sales.recordCount} sale records have no recorded
            quantity (older cash-ledger entries only recorded the amount received, not litres) — Revenue is complete,
            but Litres Sold undercounts actual volume for {year}. &ldquo;Customers&rdquo; only counts sales with a
            named buyer; most historical entries never recorded who bought it, so this will read low until Milk
            Sale Entry is used going forward.
          </p>
        )}
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <h2 className="font-semibold text-neutral-900 mb-1">Milk Production — {year}</h2>
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

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <h2 className="font-semibold text-neutral-900 mb-1">Production vs. Sold — {year}</h2>
        <p className="text-xs text-neutral-400 mb-2">
          &ldquo;Unaccounted&rdquo; is produced minus recorded sales — it is not necessarily in-house consumption;
          nothing currently tracks calf/household use, wastage, or rejected milk separately, so this gap can include
          any of those plus sales that just haven&apos;t been logged yet.
        </p>
        <ProductionVsSoldChart data={productionVsSold} />
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
