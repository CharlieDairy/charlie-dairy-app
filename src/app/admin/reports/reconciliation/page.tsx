import Link from "next/link";
import { getProductionReconciliation } from "@/lib/reports/reconciliation";
import { formatRs } from "@/lib/format";

export default async function ReconciliationPage() {
  const rows = await getProductionReconciliation(60);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Production Reconciliation</h1>
        <Link href="/entry/milk-usage" className="text-sm text-primary underline">+ Farm/Employee Use Entry</Link>
      </div>
      <p className="text-sm text-neutral-500 max-w-2xl">
        Full chain from daily production to what actually reached the market: Produced, minus Farm Use and Employee
        Use (recorded via Farm/Employee Use Entry), minus Recorded Sales. What&apos;s left is the true unexplained
        variance — it should trend to zero once use and sales are both logged day to day. Farm/Employee Use is valued
        at the farm&apos;s average sale rate as a notional cost (no cash actually moves, so it never creates a Cash
        Entry) — historical sale volumes weren&apos;t migrated from the old spreadsheets, so early-date variance will
        show as fully unaccounted for.
      </p>
      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-right px-3 py-2">Produced (L)</th>
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
                <td className="px-3 py-2 text-right">{r.farmUseLitres.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">{r.employeeUseLitres.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">{r.recordedSaleLitres.toFixed(1)}</td>
                <td className={`px-3 py-2 text-right ${Math.abs(r.varianceLitres) > 0.05 ? "text-danger" : ""}`}>{r.varianceLitres.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">{formatRs(r.notionalUseCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
