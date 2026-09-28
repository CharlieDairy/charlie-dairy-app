import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatRs } from "@/lib/format";
import StatCard from "@/components/StatCard";
import TrendStat from "@/components/TrendStat";
import {
  getMilkMonthComparison,
  getAvailableYears,
  getMonthlyMilkTrend,
  getTopLowProducers,
  getSalesSummary,
  getFreshAndDryOffCows,
} from "@/lib/reports/milkAnalytics";

function ProducerTable({ title, rows }: { title: string; rows: { cowId: string; tag: string; totalLitres: number; avgPerDay: number; daysRecorded: number }[] }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-neutral-700 mb-3">{title}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-neutral-500">
            <th className="text-left py-1 font-normal">Tag</th>
            <th className="text-right py-1 font-normal">Avg/Day</th>
            <th className="text-right py-1 font-normal">Total</th>
            <th className="text-right py-1 font-normal">Days</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cowId} className="border-t border-neutral-100">
              <td className="py-1.5">
                <Link href={`/admin/cows/${r.cowId}`} className="text-primary hover:underline font-medium">{r.tag}</Link>
              </td>
              <td className="py-1.5 text-right">{r.avgPerDay.toFixed(1)} L</td>
              <td className="py-1.5 text-right">{r.totalLitres.toFixed(1)} L</td>
              <td className="py-1.5 text-right text-neutral-400">{r.daysRecorded}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-neutral-400">Not enough data yet (needs 5+ recorded days).</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function DimTable({ title, rows, emptyMessage }: { title: string; rows: { cowId: string; tag: string; dim: number }[]; emptyMessage: string }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-neutral-700 mb-3">{title}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-neutral-500">
            <th className="text-left py-1 font-normal">Tag</th>
            <th className="text-right py-1 font-normal">DIM</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cowId} className="border-t border-neutral-100">
              <td className="py-1.5">
                <Link href={`/admin/cows/${r.cowId}`} className="text-primary hover:underline font-medium">{r.tag}</Link>
              </td>
              <td className="py-1.5 text-right">{r.dim}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={2} className="py-4 text-center text-neutral-400">{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default async function MilkAnalyticsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const params = await searchParams;
  const years = await getAvailableYears();
  const year = params.year ? parseInt(params.year, 10) : years[0];

  const [monthComparison, milkingCows, trend, producers, sales, dimRows] = await Promise.all([
    getMilkMonthComparison(),
    prisma.cow.count({ where: { status: "MILKING" } }),
    getMonthlyMilkTrend(year),
    getTopLowProducers(year, 5),
    getSalesSummary(year),
    getFreshAndDryOffCows(),
  ]);

  const peakMonth = trend.filter((t) => t.litres > 0).reduce((best, t) => (!best || t.litres > best.litres ? t : best), null as (typeof trend)[number] | null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Milk Analytics</h1>
        <form className="flex items-center gap-2">
          <label className="text-xs text-neutral-500">Year</label>
          <select name="year" defaultValue={year} className="border border-neutral-300 rounded-md px-2 py-1 text-sm">
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button type="submit" className="text-xs rounded-md px-2 py-1 border border-neutral-300 hover:bg-neutral-100">Go</button>
        </form>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Milking Cows" value={milkingCows.toString()} />
        <TrendStat label="Avg Litres / Day (this month)" value={monthComparison.avgPerDay.current.toFixed(1)} comparison={monthComparison.avgPerDay} />
        <StatCard label="Fresh Cows (<60 DIM)" value={dimRows.fresh.length.toString()} />
        <StatCard label="Dry-Off Candidates (>305 DIM)" value={dimRows.dryOff.length.toString()} tone={dimRows.dryOff.length > 0 ? "negative" : "neutral"} />
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">Monthly Production — {year}{peakMonth ? ` · Peak: ${peakMonth.monthLabel} (${peakMonth.litres.toLocaleString()} L)` : ""}</h3>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 items-end h-32">
          {trend.map((m) => {
            const max = Math.max(...trend.map((t) => t.litres), 1);
            return (
              <div key={m.month} className="flex flex-col items-center gap-1 h-full justify-end">
                <div className="w-full bg-primary/80 rounded-t" style={{ height: `${(m.litres / max) * 100}%`, minHeight: m.litres > 0 ? "2px" : 0 }} title={`${m.monthLabel}: ${m.litres} L`} />
                <span className="text-[10px] text-neutral-400">{m.monthLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProducerTable title={`Top Producers · ${year}`} rows={producers.top} />
        <ProducerTable title={`Needs Attention (Lowest) · ${year}`} rows={producers.low} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DimTable title="Fresh Cows (<60 DIM)" rows={dimRows.fresh} emptyMessage="No cows freshened in the last 60 days." />
        <DimTable title="Dry-Off Candidates (>305 DIM)" rows={dimRows.dryOff} emptyMessage="No cows past 305 days in milk." />
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">Revenue · {year}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Total Revenue" value={formatRs(sales.totalRsSold)} />
          <StatCard label="Litres Sold (recorded)" value={sales.totalLitresSold.toLocaleString()} />
          <StatCard label="Avg Price / L" value={sales.totalLitresSold > 0 ? formatRs(sales.totalRsSold / sales.totalLitresSold) : "—"} tone={sales.recordsWithQuantity < sales.recordCount ? "negative" : "neutral"} />
        </div>
        <p className="text-xs text-neutral-400 mt-2">{sales.customerCount} identified customers · {sales.recordCount} sale records.</p>
        {sales.recordsWithQuantity < sales.recordCount && (
          <p className="text-xs text-danger mt-1">
            Only {sales.recordsWithQuantity} of {sales.recordCount} records have litres recorded — the rest are historical
            cash-ledger backfills with a known Rs amount but no litres. Avg Price/L is skewed by this and should not be
            trusted as-is; Total Revenue is still accurate.
          </p>
        )}
      </div>

      <p className="text-xs text-neutral-400">
        Milk quality/SCC tracking and Production Targets aren&apos;t included — there&apos;s no underlying data model for
        either yet (no somatic cell count field, no target-setting table). Let us know if you want either built.
      </p>
    </div>
  );
}
