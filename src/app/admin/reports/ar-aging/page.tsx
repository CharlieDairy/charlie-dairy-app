import StatCard from "@/components/StatCard";
import { formatRs } from "@/lib/format";
import { getArAging } from "@/lib/reports/milkSalesByCustomer";

export default async function ArAgingPage() {
  const rows = await getArAging();

  const totals = rows.reduce(
    (acc, r) => ({
      current: acc.current + r.current,
      days31to60: acc.days31to60 + r.days31to60,
      days61to90: acc.days61to90 + r.days61to90,
      over90: acc.over90 + r.over90,
      total: acc.total + r.total,
    }),
    { current: 0, days31to60: 0, days61to90: 0, over90: 0, total: 0 }
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">AR Aging</h1>
      <p className="text-sm text-neutral-500 max-w-2xl">
        Customers&apos; unpaid milk sale balances, bucketed by how long each unpaid sale has been outstanding
        (oldest sales assumed paid first).
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatCard label="Current (0-30d)" value={formatRs(totals.current)} />
        <StatCard label="31-60 Days" value={formatRs(totals.days31to60)} tone={totals.days31to60 > 0 ? "negative" : "neutral"} />
        <StatCard label="61-90 Days" value={formatRs(totals.days61to90)} tone={totals.days61to90 > 0 ? "negative" : "neutral"} />
        <StatCard label="Over 90 Days" value={formatRs(totals.over90)} tone={totals.over90 > 0 ? "negative" : "neutral"} />
        <StatCard label="Total Outstanding" value={formatRs(totals.total)} tone={totals.total > 0 ? "negative" : "positive"} />
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Customer</th>
              <th className="text-right px-3 py-2 font-medium text-neutral-600">Current</th>
              <th className="text-right px-3 py-2 font-medium text-neutral-600">31-60d</th>
              <th className="text-right px-3 py-2 font-medium text-neutral-600">61-90d</th>
              <th className="text-right px-3 py-2 font-medium text-neutral-600">90d+</th>
              <th className="text-right px-3 py-2 font-medium text-neutral-600">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.buyer} className="border-t border-neutral-100">
                <td className="px-3 py-2 font-medium">{r.buyer}</td>
                <td className="px-3 py-2 text-right">{r.current ? formatRs(r.current) : "—"}</td>
                <td className="px-3 py-2 text-right">{r.days31to60 ? formatRs(r.days31to60) : "—"}</td>
                <td className="px-3 py-2 text-right">{r.days61to90 ? formatRs(r.days61to90) : "—"}</td>
                <td className={`px-3 py-2 text-right ${r.over90 > 0 ? "text-red-600 font-medium" : ""}`}>{r.over90 ? formatRs(r.over90) : "—"}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatRs(r.total)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-neutral-400">No outstanding balances — everyone&apos;s paid up.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
