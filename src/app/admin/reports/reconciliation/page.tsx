import { getProductionReconciliation } from "@/lib/reports/reconciliation";

export default async function ReconciliationPage() {
  const rows = await getProductionReconciliation(60);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Production Reconciliation</h1>
      <p className="text-sm text-neutral-500">
        Compares daily milk production (from milking entries) against recorded milk sales. Historical sale volumes
        were not migrated from the old spreadsheets, so variance will show as fully unaccounted for until sales are
        logged day to day going forward via Milk Sale Entry.
      </p>
      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-right px-3 py-2">Produced (L)</th>
              <th className="text-right px-3 py-2">Recorded Sales (L)</th>
              <th className="text-right px-3 py-2">Variance (L)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date} className="border-t border-neutral-100">
                <td className="px-3 py-2">{r.date.slice(0, 10)}</td>
                <td className="px-3 py-2 text-right">{r.producedLitres.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">{r.recordedSaleLitres.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">{r.varianceLitres.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
