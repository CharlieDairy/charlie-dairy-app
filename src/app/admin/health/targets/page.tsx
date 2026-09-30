import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import StatCard from "@/components/StatCard";
import DeleteRowButton from "@/components/DeleteRowButton";
import AddTargetForm from "./AddTargetForm";
import BulkSetTargetsForm from "./BulkSetTargetsForm";
import { deleteProductionTarget } from "./actions";

function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}

export default async function ProductionTargetsPage() {
  const [targets, cows, session] = await Promise.all([
    prisma.productionTarget.findMany({
      where: { active: true },
      include: { cow: { select: { id: true, tag: true, status: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.cow.findMany({ where: { status: { notIn: ["SOLD", "DEAD"] } }, select: { id: true, tag: true }, orderBy: { tag: "asc" } }),
    auth(),
  ]);
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const milkTargets = targets.filter((t) => t.type === "MILK_DAILY");
  const weightTargets = targets.filter((t) => t.type === "WEIGHT");

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const milkAgg = milkTargets.length
    ? await prisma.milkingRecord.groupBy({
        by: ["cowId"],
        where: { cowId: { in: milkTargets.map((t) => t.cowId) }, date: { gte: thirtyDaysAgo } },
        _sum: { litres: true },
      })
    : [];
  const milkActualByCow = new Map(milkAgg.map((r) => [r.cowId, (r._sum.litres ?? 0) / 30]));

  const weightRows = weightTargets.length
    ? await prisma.weightRecord.findMany({
        where: { cowId: { in: weightTargets.map((t) => t.cowId) } },
        orderBy: { date: "desc" },
        select: { cowId: true, weightKg: true, date: true },
      })
    : [];
  const weightActualByCow = new Map<string, number>();
  for (const w of weightRows) {
    if (!weightActualByCow.has(w.cowId)) weightActualByCow.set(w.cowId, w.weightKg);
  }

  const rows = targets.map((t) => {
    const actual = t.type === "MILK_DAILY" ? milkActualByCow.get(t.cowId) ?? 0 : weightActualByCow.get(t.cowId) ?? 0;
    const progressPct = t.targetValue > 0 ? Math.min(100, Math.round((actual / t.targetValue) * 100)) : 0;
    return { ...t, actual, progressPct };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Production Targets</h1>
          <p className="text-sm text-neutral-500 max-w-2xl">Set and track milk and weight goals per animal.</p>
        </div>
        <BulkSetTargetsForm />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="Total Targets" value={String(targets.length)} />
        <StatCard label="Milk Targets" value={String(milkTargets.length)} />
        <StatCard label="Weight Targets" value={String(weightTargets.length)} />
        <StatCard label="Active" value={String(targets.length)} tone="positive" />
      </div>

      <AddTargetForm cows={cows} />

      <div className="bg-white border border-neutral-200 rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Tag</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Target</th>
              <th className="text-left px-3 py-2">Actual (last 30d / latest)</th>
              <th className="text-left px-3 py-2">Progress</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-t border-neutral-100">
                <td className="px-3 py-2 font-medium">{t.cow.tag}</td>
                <td className="px-3 py-2">{t.type === "MILK_DAILY" ? "Milk (L/day)" : "Weight (kg)"}</td>
                <td className="px-3 py-2">{t.targetValue.toLocaleString()}</td>
                <td className="px-3 py-2">{t.actual.toFixed(1)}</td>
                <td className="px-3 py-2 w-40">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden min-w-[60px]">
                      <div className={`h-full ${t.progressPct >= 100 ? "bg-green-700" : "bg-amber-500"}`} style={{ width: `${t.progressPct}%` }} />
                    </div>
                    <span className="text-xs text-neutral-500 w-10 text-right">{t.progressPct}%</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  {isAdmin && (
                    <DeleteRowButton
                      action={deleteProductionTarget}
                      hiddenFields={{ id: t.id }}
                      confirmMessage={`Delete this target for Cow ${t.cow.tag}?`}
                      icon={<IconTrash />}
                    />
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-neutral-400">
                  No production targets yet — set one above to track milk and weight goals.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
