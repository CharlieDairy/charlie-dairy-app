import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getMedicineStockOverview } from "@/lib/reports/medicineStock";
import StatCard from "@/components/StatCard";
import Badge from "@/components/Badge";
import RestockForm from "./RestockForm";
import RecordActions from "@/components/RecordActions";
import { getLiveUser, hasPermission } from "@/lib/access";
import { updateRestock, deleteRestock } from "./recordActions";

function stockTone(balance: number, daysRemaining: number | null): { tone: "danger" | "warning" | "success" | "neutral"; label: string } {
  if (balance < 0) return { tone: "danger", label: "Deficit" };
  if (daysRemaining === null) return { tone: "neutral", label: "No recent use" };
  if (daysRemaining < 7) return { tone: "danger", label: `${Math.round(daysRemaining)}d left` };
  if (daysRemaining < 14) return { tone: "warning", label: `${Math.round(daysRemaining)}d left` };
  return { tone: "success", label: `${Math.round(daysRemaining)}d left` };
}

export default async function MedicineStockPage() {
  const live = await getLiveUser();
  const canEdit = !!live && hasPermission(live, "health", "EDIT");
  const canDelete = !!live && hasPermission(live, "health", "DELETE");
  const restocks = await prisma.medicineStockTransaction.findMany({
    where: { direction: "IN" },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 30,
    include: { medicineDef: { select: { name: true, unit: true } } },
  });
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

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <h2 className="font-semibold text-neutral-900 mb-1">Recent restocks</h2>
        <p className="text-xs text-neutral-500 mb-2">Stock used by treatments is changed by editing the treatment on the animal&apos;s profile.</p>
        {restocks.length === 0 ? (
          <p className="text-sm text-neutral-400">No restocks recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {restocks.map((r) => {
                  const d = r.date.toISOString().slice(0, 10);
                  return (
                    <tr key={r.id} className="border-t border-neutral-100">
                      <td className="py-1">{d}</td>
                      <td className="py-1">{r.medicineDef.name}</td>
                      <td className="py-1 text-right">{r.quantity} {r.medicineDef.unit}</td>
                      <td className="py-1 pl-3 text-neutral-500">{r.notes ?? ""}</td>
                      <td className="py-1 text-right">
                        <RecordActions
                          id={r.id}
                          title={`${r.medicineDef.name} restock ${d}`}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          updateAction={updateRestock}
                          deleteAction={deleteRestock}
                          deleteConfirm={`Delete the ${r.quantity} ${r.medicineDef.unit} restock of ${r.medicineDef.name} on ${d}?`}
                          fields={[
                            { name: "date", label: "Date", type: "date", value: d, required: true },
                            { name: "quantity", label: `Quantity (${r.medicineDef.unit})`, type: "number", step: "0.1", value: String(r.quantity), required: true },
                            { name: "cost", label: "Cost", type: "number", step: "1", value: r.cost == null ? "" : String(r.cost) },
                            { name: "notes", label: "Notes", type: "textarea", value: r.notes ?? "" },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
