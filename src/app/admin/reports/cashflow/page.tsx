import { getMonthlyCashFlow } from "@/lib/reports/pnl";
import { formatRs } from "@/lib/format";

export default async function CashFlowPage() {
  const monthly = await getMonthlyCashFlow();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Cash Flow Statement</h1>
      <p className="text-sm text-neutral-500">Cash-basis: every transaction counted in the month it happened.</p>
      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Month</th>
              <th className="text-right px-3 py-2">Net Cash Flow</th>
              <th className="text-right px-3 py-2">Cumulative Cash Position</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((m) => (
              <tr key={m.month} className="border-t border-neutral-100">
                <td className="px-3 py-2">{m.month}</td>
                <td className={`px-3 py-2 text-right ${m.netCashFlow >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {formatRs(m.netCashFlow)}
                </td>
                <td className={`px-3 py-2 text-right font-medium ${m.cumulativeCash >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {formatRs(m.cumulativeCash)}
                </td>
              </tr>
            ))}
            {monthly.length === 0 && (
              <tr><td colSpan={3} className="px-3 py-6 text-center text-neutral-500">No cash transactions recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
