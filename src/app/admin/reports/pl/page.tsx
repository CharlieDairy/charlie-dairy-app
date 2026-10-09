import { getMonthlyPnl } from "@/lib/reports/pnl";
import { formatRs } from "@/lib/format";
import { compare } from "@/lib/compare";
import TrendStat from "@/components/TrendStat";

const R = "px-3 py-2 text-right";

export default async function PnlPage() {
  const monthly = await getMonthlyPnl();
  const current = monthly[monthly.length - 1];
  const previous = monthly[monthly.length - 2];
  const total = (f: (m: (typeof monthly)[number]) => number) => monthly.reduce((n, m) => n + f(m), 0);
  const review = total((m) => Math.abs(m.byClass.REVIEW));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">P&L Statement</h1>
        <p className="text-sm text-neutral-500">Cash basis: money counts when it is received or paid.</p>
      </div>

      <p className="rounded-lg border border-border bg-white px-4 py-3 text-sm text-neutral-600">
        <b>Revenue</b> = milk sales + animal and calf sales + other income. <b>Cost</b> = what it cost to run the farm. Capital spending,
        money put in by the partners and money sent to them move cash but are <b>not</b> profit or loss, so they are shown separately in the second table.
        Receipts paid into a bank account that is not in the Cash Register (for example Engro) are not here until that book is added.
      </p>

      {current && previous && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <TrendStat label={`Revenue (${current.month})`} value={formatRs(current.revenue)} comparison={compare(current.revenue, previous.revenue)} />
          <TrendStat label={`Cost (${current.month})`} value={formatRs(current.expense)} comparison={compare(current.expense, previous.expense)} invertTone />
          <TrendStat label={`Net profit (${current.month})`} value={formatRs(current.net)} comparison={compare(current.net, previous.net)} />
          <TrendStat label={`Milk only (${current.month})`} value={formatRs(current.milkNet)} comparison={compare(current.milkNet, previous.milkNet)} />
        </div>
      )}

      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Month</th>
              <th className="text-right px-3 py-2">Milk sales</th>
              <th className="text-right px-3 py-2">Animal &amp; calf sales</th>
              <th className="text-right px-3 py-2">Other income</th>
              <th className="text-right px-3 py-2">Revenue</th>
              <th className="text-right px-3 py-2">Cost</th>
              <th className="text-right px-3 py-2">Net profit</th>
              <th className="text-right px-3 py-2">Milk only</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((m) => (
              <tr key={m.month} className="border-t border-neutral-100">
                <td className="px-3 py-2">{m.month}</td>
                <td className={R}>{formatRs(m.byClass.MILK_SALES)}</td>
                <td className={R}>{formatRs(m.byClass.LIVESTOCK_SALES)}</td>
                <td className={R}>{formatRs(m.byClass.OTHER_INCOME)}</td>
                <td className={`${R} font-medium`}>{formatRs(m.revenue)}</td>
                <td className={R}>{formatRs(m.expense)}</td>
                <td className={`${R} font-medium ${m.net >= 0 ? "text-green-700" : "text-red-600"}`}>{formatRs(m.net)}</td>
                <td className={`${R} ${m.milkNet >= 0 ? "text-green-700" : "text-red-600"}`}>{formatRs(m.milkNet)}</td>
              </tr>
            ))}
            {monthly.length > 0 && (
              <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className={R}>{formatRs(total((m) => m.byClass.MILK_SALES))}</td>
                <td className={R}>{formatRs(total((m) => m.byClass.LIVESTOCK_SALES))}</td>
                <td className={R}>{formatRs(total((m) => m.byClass.OTHER_INCOME))}</td>
                <td className={R}>{formatRs(total((m) => m.revenue))}</td>
                <td className={R}>{formatRs(total((m) => m.expense))}</td>
                <td className={R}>{formatRs(total((m) => m.net))}</td>
                <td className={R}>{formatRs(total((m) => m.milkNet))}</td>
              </tr>
            )}
            {monthly.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-neutral-500">No cash transactions recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Cash that is not profit or loss</h2>
        <p className="text-sm text-neutral-500">Money that moved but does not belong in the profit above.</p>
      </div>
      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Month</th>
              <th className="text-right px-3 py-2">Capital spending</th>
              <th className="text-right px-3 py-2">From partners</th>
              <th className="text-right px-3 py-2">To partners</th>
              <th className="text-right px-3 py-2">Needs review</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((m) => (
              <tr key={m.month} className="border-t border-neutral-100">
                <td className="px-3 py-2">{m.month}</td>
                <td className={R}>{formatRs(m.byClass.CAPEX)}</td>
                <td className={R}>{formatRs(m.byClass.PARTNER_IN)}</td>
                <td className={R}>{formatRs(m.byClass.PARTNER_OUT)}</td>
                <td className={`${R} ${m.byClass.REVIEW !== 0 ? "text-amber-700" : "text-neutral-400"}`}>{m.byClass.REVIEW !== 0 ? formatRs(m.byClass.REVIEW) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {review > 0 && (
        <p className="text-xs text-amber-700">Entries marked &quot;Needs review&quot; are not in the profit yet. An Admin can set their class on the Cash Register (edit the entry).</p>
      )}

      <h2 className="text-lg font-semibold text-neutral-900">Category breakdown</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {monthly.map((m) => (
          <div key={m.month} className="bg-white border border-neutral-200 rounded-lg p-4">
            <div className="font-medium mb-2">{m.month}</div>
            <div className="text-xs uppercase text-neutral-500 mb-1">Revenue</div>
            <ul className="text-sm mb-2">
              {Object.entries(m.revenueByCategory).map(([cat, amt]) => (
                <li key={cat} className="flex justify-between"><span>{cat}</span><span>{formatRs(amt)}</span></li>
              ))}
            </ul>
            <div className="text-xs uppercase text-neutral-500 mb-1">Cost</div>
            <ul className="text-sm">
              {Object.entries(m.expenseByCategory).map(([cat, amt]) => (
                <li key={cat} className="flex justify-between"><span>{cat}</span><span>{formatRs(amt)}</span></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
