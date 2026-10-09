import { getMonthlyCashFlow } from "@/lib/reports/pnl";
import { formatRs } from "@/lib/format";
import { compare } from "@/lib/compare";
import TrendStat from "@/components/TrendStat";

const R = "px-3 py-2 text-right";
const tone = (n: number) => (n >= 0 ? "text-green-700" : "text-red-600");

export default async function CashFlowPage() {
  const monthly = await getMonthlyCashFlow();
  const current = monthly[monthly.length - 1];
  const previous = monthly[monthly.length - 2];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Cash Flow Statement</h1>
      <p className="text-sm text-neutral-500">
        Every rupee that moved in the Cash Register, split by what it was for: <b>running the farm</b> (milk and animal sales, minus costs),{" "}
        <b>capital spending</b> (assets, repairs that last), and <b>partners</b> (money put in or taken out), plus <b>between books</b> (bank to petty cash, which cancels out across the farm&apos;s books). Together they add up to the net cash flow.
      </p>
      {current && previous && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <TrendStat label={`Net Cash Flow (${current.month})`} value={formatRs(current.netCashFlow)} comparison={compare(current.netCashFlow, previous.netCashFlow)} />
          <TrendStat label="Cumulative Cash Position" value={formatRs(current.cumulativeCash)} comparison={compare(current.cumulativeCash, previous.cumulativeCash)} />
          <TrendStat label={`Running the farm (${current.month})`} value={formatRs(current.operating)} comparison={compare(current.operating, previous.operating)} />
        </div>
      )}
      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Month</th>
              <th className="text-right px-3 py-2">Cash In</th>
              <th className="text-right px-3 py-2">Cash Out</th>
              <th className="text-right px-3 py-2">Running the farm</th>
              <th className="text-right px-3 py-2">Capital spending</th>
              <th className="text-right px-3 py-2">Partners</th>
              <th className="text-right px-3 py-2">Between books</th>
              <th className="text-right px-3 py-2">Net Cash Flow</th>
              <th className="text-right px-3 py-2">Cash Position</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((m) => (
              <tr key={m.month} className="border-t border-neutral-100">
                <td className="px-3 py-2">{m.month}</td>
                <td className={`${R} text-green-700`}>{formatRs(m.cashIn)}</td>
                <td className={`${R} text-red-600`}>{formatRs(m.cashOut)}</td>
                <td className={`${R} ${tone(m.operating)}`}>{formatRs(m.operating)}</td>
                <td className={`${R} ${tone(m.investing)}`}>{formatRs(m.investing)}</td>
                <td className={`${R} ${tone(m.financing)}`}>{formatRs(m.financing)}</td>
                <td className={`${R} text-neutral-500`}>{formatRs(m.transfers)}</td>
                <td className={`${R} font-medium ${tone(m.netCashFlow)}`}>{formatRs(m.netCashFlow)}</td>
                <td className={`${R} font-medium ${tone(m.cumulativeCash)}`}>{formatRs(m.cumulativeCash)}</td>
              </tr>
            ))}
            {monthly.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-neutral-500">No cash transactions recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500">The first month includes the opening balance carried from the CashBook. Entries still marked &quot;Needs review&quot; are counted in the net cash flow but not in any of the three groups.</p>
    </div>
  );
}
