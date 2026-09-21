import { getHerdSummary } from "@/lib/reports/herd";

export default async function HerdSummaryPage() {
  const rows = await getHerdSummary();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Herd Summary</h1>
      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Tag</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Days Milked</th>
              <th className="text-right px-3 py-2">Total Litres</th>
              <th className="text-right px-3 py-2">Avg L / Day</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cowId} className="border-t border-neutral-100">
                <td className="px-3 py-2">{r.tag}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2 text-right">{r.daysMilked}</td>
                <td className="px-3 py-2 text-right">{r.totalLitres.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">{r.avgLitresPerDay.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
