import Link from "next/link";
import { getInventoryOverview } from "@/lib/reports/inventory";
import { formatRs } from "@/lib/format";
import TrendStat from "@/components/TrendStat";
import StatCard from "@/components/StatCard";
import Badge from "@/components/Badge";

export default async function InventoryDashboardPage() {
  const overview = await getInventoryOverview();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Inventory</h1>
        <div className="flex items-center gap-3">
          <Link href="/entry/inventory" className="text-sm text-primary underline">+ Add Entry</Link>
          <Link href="/admin/inventory/items" className="text-sm text-neutral-500 underline">Manage Items</Link>
        </div>
      </div>
      <p className="text-sm text-neutral-500 max-w-2xl">
        Stock on hand per item (running total of every Inventory Entry in/out), flagged low when it drops to or below
        the item&apos;s reorder level.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
        <StatCard label="Low Stock Items" value={overview.lowStockCount.toString()} tone={overview.lowStockCount > 0 ? "negative" : "positive"} />
        <TrendStat label="Consumed This Month" value={overview.quantityOut.current.toLocaleString(undefined, { maximumFractionDigits: 0 })} comparison={overview.quantityOut} invertTone />
        <TrendStat label="Cost This Month" value={formatRs(overview.costOut.current)} comparison={overview.costOut} invertTone />
      </div>

      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Item</th>
              <th className="text-left px-3 py-2">Category</th>
              <th className="text-right px-3 py-2">Balance on Hand</th>
              <th className="text-right px-3 py-2">Reorder Level</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Cost This Month</th>
            </tr>
          </thead>
          <tbody>
            {overview.items.map((item) => (
              <tr key={item.itemId} className="border-t border-neutral-100">
                <td className="px-3 py-2 font-medium">{item.name}</td>
                <td className="px-3 py-2">{item.category ?? "—"}</td>
                <td className={`px-3 py-2 text-right ${item.balance < 0 ? "text-danger" : ""}`}>
                  {item.balance.toLocaleString(undefined, { maximumFractionDigits: 1 })} {item.unit}
                </td>
                <td className="px-3 py-2 text-right">{item.reorderLevel !== null ? `${item.reorderLevel} ${item.unit}` : "—"}</td>
                <td className="px-3 py-2">
                  {item.lowStock ? (
                    <Badge tone="danger">Low Stock</Badge>
                  ) : item.reorderLevel === null ? (
                    <Badge tone="neutral">No Reorder Level</Badge>
                  ) : (
                    <Badge tone="success">OK</Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{formatRs(item.costThisMonth)}</td>
              </tr>
            ))}
            {overview.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-neutral-500">No active inventory items yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {overview.items.some((b) => b.balance < 0) && (
        <p className="text-xs text-danger">
          A negative balance means more was logged as used (OUT) than was ever recorded as received (IN) for that
          item — check for a missing Inventory Entry or a data-entry mistake.
        </p>
      )}
    </div>
  );
}
