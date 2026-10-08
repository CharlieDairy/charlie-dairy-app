import Link from "next/link";
import { getHealthOverview, getUpcomingVaccinations, getRecentHealthEvents } from "@/lib/reports/health";
import { formatRs } from "@/lib/format";
import TrendStat from "@/components/TrendStat";
import StatCard from "@/components/StatCard";
import Badge from "@/components/Badge";

function fmtDate(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

export default async function HealthDashboardPage() {
  const [overview, upcoming, recent] = await Promise.all([
    getHealthOverview(),
    getUpcomingVaccinations(),
    getRecentHealthEvents(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Health</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <TrendStat label="Vaccinations This Month" value={overview.vaccinationsThisMonth.current.toString()} comparison={overview.vaccinationsThisMonth} />
        <TrendStat label="Treatments This Month" value={overview.treatmentsThisMonth.current.toString()} comparison={overview.treatmentsThisMonth} invertTone />
        <TrendStat label="Health Cost This Month" value={formatRs(overview.healthCostThisMonth.current)} comparison={overview.healthCostThisMonth} invertTone />
        <StatCard label="Due in 30 Days" value={overview.dueSoonCount.toString()} tone={overview.dueSoonCount > 0 ? "negative" : "neutral"} />
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <h2 className="font-semibold text-neutral-900 mb-2">Upcoming / Overdue Vaccinations</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-neutral-400">Nothing due in the next 30 days.</p>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-neutral-500">
                <th className="text-left py-1 font-normal">Animal</th>
                <th className="text-left py-1 font-normal">Vaccine</th>
                <th className="text-left py-1 font-normal">Due</th>
                <th className="text-left py-1 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((u) => (
                <tr key={u.id} className="border-t border-neutral-100">
                  <td className="py-1">
                    <Link href={`/admin/cows/${u.cowId}`} className="text-primary hover:underline font-medium">{u.cowTag}</Link>
                  </td>
                  <td className="py-1">{u.vaccineName}</td>
                  <td className="py-1">{fmtDate(u.nextDueDate)}</td>
                  <td className="py-1">
                    {u.overdue ? <Badge tone="danger">Overdue</Badge> : <Badge tone="warning">Upcoming</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <h2 className="font-semibold text-neutral-900 mb-2">Recent Health Events</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-neutral-400">No vaccinations or treatments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-neutral-500">
                <th className="text-left py-1 font-normal">Date</th>
                <th className="text-left py-1 font-normal">Animal</th>
                <th className="text-left py-1 font-normal">Type</th>
                <th className="text-left py-1 font-normal">Detail</th>
                <th className="text-right py-1 font-normal">Cost</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((e) => (
                <tr key={`${e.kind}-${e.id}`} className="border-t border-neutral-100">
                  <td className="py-1">{fmtDate(e.date)}</td>
                  <td className="py-1">{e.cowTag}</td>
                  <td className="py-1">{e.kind}</td>
                  <td className="py-1">{e.label}</td>
                  <td className="py-1 text-right">{e.cost != null ? formatRs(e.cost) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
