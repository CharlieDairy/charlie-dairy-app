import { getMonthlyCashFlow } from "@/lib/reports/pnl";
import { formatRs } from "@/lib/format";
import { compare } from "@/lib/compare";
import TrendStat from "@/components/TrendStat";

export default async function CashFlowPage() {
  const monthly = await getMonthlyCashFlow();
  const current = monthly[monthly.length - 1];
  const previous = monthly[monthly.length - 2];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Cash Flow Statement</h1>
      <p className="text-sm text-neutral-500">
        True cash movements only, from the Cash Register ledger — a milk sale made on credit counts as revenue on
        the P&amp;L Statement, but only shows up here once it&apos;s actually paid.
      </p>
      {current && previous && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <TrendStat label={`Net Cash Flow (${current.month})`} value={formatRs(current.netCashFlow)} comparison={compare(current.netCashFlow, previous.netCashFlow)} />
          <TrendStat label="Cumulative Cash Position" value={formatRs(current.cumulativeCash)} comparison={compare(current.cumulativeCash, previous.cumulativeCash)} />
        </div>
      )}
      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Month</th>
              <th className="text-right px-3 py-2">Cash In</th>
              <th className="text-right px-3 py-2">Cash Out</th>
              <th className="text-right px-3 py-2">Net Cash Flow</th>
              <th className="text-right px-3 py-2">Cumulative Cash Position</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((m) => (
              <tr key={m.month} className="border-t border-neutral-100">
                <td className="px-3 py-2">{m.month}</td>
                <td className="px-3 py-2 text-right text-green-700">{formatRs(m.cashIn)}</td>
                <td className="px-3 py-2 text-right text-red-600">{formatRs(m.cashOut)}</td>
                <td className={`px-3 py-2 text-right ${m.netCashFlow >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {formatRs(m.netCashFlow)}
                </td>
                <td className={`px-3 py-2 text-right font-medium ${m.cumulativeCash >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {formatRs(m.cumulativeCash)}
                </td>
              </tr>
            ))}
            {monthly.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-500">No cash transactions recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
