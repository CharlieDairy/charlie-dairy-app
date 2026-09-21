import { getBreedingKpis, getBreedingRegister } from "@/lib/reports/breeding";
import StatCard from "@/components/StatCard";

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}

export default async function BreedingReportPage() {
  const [kpis, register] = await Promise.all([getBreedingKpis(), getBreedingRegister()]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Breeding &amp; Reproduction</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Pregnant" value={kpis.pregnantCount.toString()} />
        <StatCard label="Due to Calve (30d)" value={kpis.dueNext30Days.toString()} />
        <StatCard label="Due to Calve (60d)" value={kpis.dueNext60Days.toString()} />
        <StatCard label="Open Cows" value={kpis.openCowsCount.toString()} />
        <StatCard label="Avg Days Open" value={kpis.avgDaysOpen !== null ? `${kpis.avgDaysOpen} d` : "—"} />
        <StatCard
          label="Conception Rate"
          value={kpis.conceptionRatePct !== null ? `${kpis.conceptionRatePct}%` : "—"}
          tone={kpis.conceptionRatePct !== null ? (kpis.conceptionRatePct >= 50 ? "positive" : "negative") : undefined}
        />
        <StatCard label="Services / Conception" value={kpis.servicesPerConception !== null ? kpis.servicesPerConception.toString() : "—"} />
      </div>

      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Tag</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Lactation #</th>
              <th className="text-left px-3 py-2">Last Calving</th>
              <th className="text-left px-3 py-2">Latest Service</th>
              <th className="text-right px-3 py-2">Service #</th>
              <th className="text-left px-3 py-2">Expected Calving</th>
              <th className="text-left px-3 py-2">Dry-Off Due</th>
              <th className="text-right px-3 py-2">Days Open</th>
            </tr>
          </thead>
          <tbody>
            {register.map((r) => (
              <tr key={r.cowId} className="border-t border-neutral-100">
                <td className="px-3 py-2 font-medium">{r.tag}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2 text-right">{r.lactationNumber}</td>
                <td className="px-3 py-2">{fmtDate(r.lastCalvingDate)}</td>
                <td className="px-3 py-2">{fmtDate(r.latestInseminationDate)}</td>
                <td className="px-3 py-2 text-right">{r.serviceNumber ?? "—"}</td>
                <td className="px-3 py-2">{fmtDate(r.expectedCalving)}</td>
                <td className="px-3 py-2">{fmtDate(r.dryDate)}</td>
                <td className="px-3 py-2 text-right">{r.daysOpen ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
