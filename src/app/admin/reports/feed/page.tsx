import Link from "next/link";
import { getFeedOverview } from "@/lib/reports/feed";
import { formatRs } from "@/lib/format";
import TrendStat from "@/components/TrendStat";
import StatCard from "@/components/StatCard";
import Badge from "@/components/Badge";

function stockTone(balance: number, daysRemaining: number | null): { tone: "danger" | "warning" | "success" | "neutral"; label: string } {
  // A negative balance means more was logged consumed than ever logged
  // received -- a data gap, not a real "days remaining" countdown, so it
  // gets its own label rather than a nonsensical negative day count.
  if (balance < 0) return { tone: "danger", label: "Deficit" };
  if (daysRemaining === null) return { tone: "neutral", label: "No recent use" };
  if (daysRemaining < 7) return { tone: "danger", label: `${Math.round(daysRemaining)}d left` };
  if (daysRemaining < 14) return { tone: "warning", label: `${Math.round(daysRemaining)}d left` };
  return { tone: "success", label: `${Math.round(daysRemaining)}d left` };
}

export default async function FeedOverviewPage() {
  const overview = await getFeedOverview();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Feed &amp; Inventory</h1>
        <Link href="/admin/feed/items" className="link-btn">Manage Feed Master</Link>
      </div>
      <p className="text-base font-semibold text-neutral-600">
        Stock on hand per feed type (running total of every Feed Entry in/out), how fast it&apos;s being used, and a
        projection of how many days of stock remain at the current consumption rate. Low Stock is flagged against the
        reorder level set in Feed Master.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Stock on Hand" value={overview.totalBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} />
        <StatCard label="Low Stock Items" value={overview.lowStockCount.toString()} tone={overview.lowStockCount > 0 ? "negative" : "positive"} />
        <TrendStat
          label="Consumed This Month"
          value={overview.quantityOut.current.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          comparison={overview.quantityOut}
          invertTone
        />
        <TrendStat label="Feed Cost This Month" value={formatRs(overview.costOut.current)} comparison={overview.costOut} invertTone />
      </div>

      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Feed Type</th>
              <th className="text-right px-3 py-2">Balance on Hand</th>
              <th className="text-right px-3 py-2">Avg Daily Use (30d)</th>
              <th className="text-right px-3 py-2">Reorder Level</th>
              <th className="text-left px-3 py-2">Stock Status</th>
              <th className="text-right px-3 py-2">Cost This Month</th>
            </tr>
          </thead>
          <tbody>
            {overview.balances.map((b) => {
              const status = stockTone(b.balance, b.daysRemaining);
              return (
                <tr key={b.feedType} className="border-t border-neutral-100">
                  <td className="px-3 py-2 font-medium">{b.feedType}</td>
                  <td className={`px-3 py-2 text-right ${b.balance < 0 ? "text-danger" : ""}`}>
                    {b.balance.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-3 py-2 text-right">{b.avgDailyConsumption.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right">{b.reorderLevel ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {b.lowStock && <Badge tone="danger">Low Stock</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{formatRs(b.costThisMonth)}</td>
                </tr>
              );
            })}
            {overview.balances.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-neutral-500">No feed transactions recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {overview.balances.some((b) => b.balance < 0) && (
        <p className="text-xs text-danger">
          A negative balance means more feed was logged as consumed (OUT) than was ever recorded as received (IN) for
          that type — check for a missing Feed Entry or a data-entry mistake.
        </p>
      )}
    </div>
  );
}
