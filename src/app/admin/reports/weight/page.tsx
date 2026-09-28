import Link from "next/link";
import { getWeightOverview, getWeightStatusRows } from "@/lib/reports/weight";
import StatCard from "@/components/StatCard";
import TrendStat from "@/components/TrendStat";
import Badge from "@/components/Badge";

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "—";
}

const STATUS_BADGE: Record<string, { tone: "success" | "warning" | "danger" | "neutral"; label: string }> = {
  under: { tone: "danger", label: "Under Target" },
  "on-target": { tone: "success", label: "On Target" },
  over: { tone: "warning", label: "Over Target" },
  "no-standard": { tone: "neutral", label: "No Standard" },
  "no-weight": { tone: "neutral", label: "No Weight Recorded" },
};

export default async function WeightDashboardPage() {
  const [overview, rows] = await Promise.all([getWeightOverview(), getWeightStatusRows()]);
  const coveragePct = overview.activeHerdSize > 0 ? (overview.animalsWeighedThisMonth / overview.activeHerdSize) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Weight</h1>
        <div className="flex items-center gap-3">
          <Link href="/entry/weight" className="text-sm text-primary underline">+ Add Weight</Link>
          <Link href="/admin/weight/standards" className="text-sm text-neutral-500 underline">Manage Standards</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <TrendStat label="Weight Records This Month" value={overview.recordsThisMonth.current.toString()} comparison={overview.recordsThisMonth} />
        <StatCard label="Animals Weighed This Month" value={`${overview.animalsWeighedThisMonth} / ${overview.activeHerdSize}`} />
        <StatCard label="Coverage" value={`${coveragePct.toFixed(0)}%`} tone={coveragePct >= 50 ? "positive" : "negative"} />
      </div>

      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Tag</th>
              <th className="text-left px-3 py-2">Breed</th>
              <th className="text-right px-3 py-2">Age (months)</th>
              <th className="text-right px-3 py-2">Latest Weight</th>
              <th className="text-left px-3 py-2">Last Weighed</th>
              <th className="text-left px-3 py-2">Target Range</th>
              <th className="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const badge = STATUS_BADGE[r.status];
              return (
                <tr key={r.cowId} className="border-t border-neutral-100">
                  <td className="px-3 py-2">
                    <Link href={`/admin/cows/${r.cowId}`} className="text-primary hover:underline font-medium">{r.tag}</Link>
                  </td>
                  <td className="px-3 py-2">{r.breed ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{r.ageMonths ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{r.latestWeightKg != null ? `${r.latestWeightKg} kg` : "—"}</td>
                  <td className="px-3 py-2">{fmtDate(r.latestWeightDate)}</td>
                  <td className="px-3 py-2">{r.standardMin != null ? `${r.standardMin}–${r.standardMax} kg` : "—"}</td>
                  <td className="px-3 py-2"><Badge tone={badge.tone}>{badge.label}</Badge></td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-neutral-500">No active animals.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
