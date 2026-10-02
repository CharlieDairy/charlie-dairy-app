import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getMedicineStockOverview } from "@/lib/reports/medicineStock";
import StatCard from "@/components/StatCard";
import Badge from "@/components/Badge";
import RestockForm from "./RestockForm";

function stockTone(balance: number, daysRemaining: number | null): { tone: "danger" | "warning" | "success" | "neutral"; label: string } {
  if (balance < 0) return { tone: "danger", label: "Deficit" };
  if (daysRemaining === null) return { tone: "neutral", label: "No recent use" };
  if (daysRemaining < 7) return { tone: "danger", label: `${Math.round(daysRemaining)}d left` };
  if (daysRemaining < 14) return { tone: "warning", label: `${Math.round(daysRemaining)}d left` };
  return { tone: "success", label: `${Math.round(daysRemaining)}d left` };
}

export default async function MedicineStockPage() {
  const [overview, medicines] = await Promise.all([
    getMedicineStockOverview(),
    prisma.medicineDef.findMany({ where: { active: true }, select: { id: true, name: true, unit: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Medicine Stock</h1>
        <Link href="/admin/health/medicines" className="link-btn">Manage Medicines →</Link>
      </div>
      <p className="text-base font-semibold text-neutral-600">
        Stock on hand per medicine (running total of restocks in, treatments out), how fast it&apos;s being used, and
        a projection of days remaining. OUT entries come automatically from Treatment Entry when a quantity is
        recorded — this page is only for restocking.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Medicines Tracked" value={overview.balances.length.toString()} />
        <StatCard label="Low Stock" value={overview.lowStockCount.toString()} tone={overview.lowStockCount > 0 ? "negative" : "positive"} />
      </div>

      <RestockForm medicines={medicines} />

      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Medicine</th>
              <th className="text-right px-3 py-2">Balance on Hand</th>
              <th className="text-right px-3 py-2">Avg Daily Use (30d)</th>
              <th className="text-right px-3 py-2">Reorder Level</th>
              <th className="text-left px-3 py-2">Stock Status</th>
            </tr>
          </thead>
          <tbody>
            {overview.balances.map((b) => {
              const status = stockTone(b.balance, b.daysRemaining);
              return (
                <tr key={b.medicineDefId} className="border-t border-neutral-100">
                  <td className="px-3 py-2 font-medium">{b.name}{b.unit ? ` (${b.unit})` : ""}</td>
                  <td className={`px-3 py-2 text-right ${b.balance < 0 ? "text-danger" : ""}`}>
                    {b.balance.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-3 py-2 text-right">{b.avgDailyUse.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right">{b.reorderLevel ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {b.lowStock && <Badge tone="danger">Low Stock</Badge>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {overview.balances.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-neutral-500">No active medicines yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {overview.balances.some((b) => b.balance < 0) && (
        <p className="text-xs text-danger">
          A negative balance means more medicine was logged used (via Treatment Entry) than was ever restocked —
          check for a missing restock entry or a data-entry mistake.
        </p>
      )}
    </div>
  );
}
