import { getMonthlyPnl } from "@/lib/reports/pnl";
import { formatRs } from "@/lib/format";

export default async function PnlPage() {
  const monthly = await getMonthlyPnl();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">P&L Statement</h1>
      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Month</th>
              <th className="text-right px-3 py-2">Revenue</th>
              <th className="text-right px-3 py-2">Expense</th>
              <th className="text-right px-3 py-2">Net</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((m) => (
              <tr key={m.month} className="border-t border-neutral-100">
                <td className="px-3 py-2">{m.month}</td>
                <td className="px-3 py-2 text-right">{formatRs(m.revenue)}</td>
                <td className="px-3 py-2 text-right">{formatRs(m.expense)}</td>
                <td className={`px-3 py-2 text-right font-medium ${m.net >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {formatRs(m.net)}
                </td>
              </tr>
            ))}
            {monthly.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-neutral-500">No cash transactions recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

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
            <div className="text-xs uppercase text-neutral-500 mb-1">Expense</div>
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
