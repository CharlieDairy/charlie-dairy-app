import Link from "next/link";
import { getProductionReconciliation } from "@/lib/reports/reconciliation";
import { formatRs } from "@/lib/format";
import type { PeriodKey } from "@/lib/reports/herd";
import MilkUsageForm from "@/app/entry/milk-usage/MilkUsageForm";
import ReconciliationChart from "./ReconciliationChart";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "day", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "all", label: "All Time" },
];

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period: PeriodKey = PERIODS.some((p) => p.key === params.period) ? (params.period as PeriodKey) : "all";
  const rows = await getProductionReconciliation(period);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Production Reconciliation</h1>
      <p className="text-sm text-neutral-500 max-w-2xl">
        Full chain from daily production to what actually reached the market: Produced, minus Calf Use, Farm Use and
        Employee Use (recorded below), minus Recorded Sales. What&apos;s left is the true unexplained variance — it
        should trend to zero once use and sales are both logged day to day. Calf/Farm/Employee Use is valued at the
        farm&apos;s average sale rate as a notional cost (no cash actually moves, so it never creates a Cash Entry) —
        historical sale volumes weren&apos;t migrated from the old spreadsheets, so early-date variance will show as
        fully unaccounted for.
      </p>

      <div className="flex gap-1.5 flex-wrap">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`?period=${p.key}`}
            className={`text-xs rounded-full px-3 py-1.5 border ${
              period === p.key ? "bg-primary text-white border-primary" : "border-border text-text-muted hover:bg-neutral-100"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">Produced vs Used vs Sold</h2>
        <ReconciliationChart rows={rows} />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-700">Record Calf / Farm / Employee Use</h2>
        <MilkUsageForm />
      </div>

      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-right px-3 py-2">Produced (L)</th>
              <th className="text-right px-3 py-2">Calf Use (L)</th>
              <th className="text-right px-3 py-2">Farm Use (L)</th>
              <th className="text-right px-3 py-2">Employee Use (L)</th>
              <th className="text-right px-3 py-2">Recorded Sales (L)</th>
              <th className="text-right px-3 py-2">Unexplained Variance (L)</th>
              <th className="text-right px-3 py-2">Notional Use Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date} className="border-t border-neutral-100">
                <td className="px-3 py-2">{r.date.slice(0, 10)}</td>
                <td className="px-3 py-2 text-right">{r.producedLitres.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">{r.calfUseLitres.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">{r.farmUseLitres.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">{r.employeeUseLitres.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">{r.recordedSaleLitres.toFixed(1)}</td>
                <td className={`px-3 py-2 text-right ${Math.abs(r.varianceLitres) > 0.05 ? "text-danger" : ""}`}>{r.varianceLitres.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">{formatRs(r.notionalUseCost)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-neutral-400">No production recorded in this period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
