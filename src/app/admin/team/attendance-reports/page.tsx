import StatCard from "@/components/StatCard";
import { getAttendanceReport } from "@/lib/reports/team";
import type { PeriodKey } from "@/lib/reports/herd";
import PeriodSelect from "./PeriodSelect";

export default async function AttendanceReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period: PeriodKey = (["day", "week", "month", "year", "all"] as const).includes(params.period as PeriodKey)
    ? (params.period as PeriodKey)
    : "month";

  const rows = await getAttendanceReport(period);

  const totalPresent = rows.reduce((n, r) => n + r.present, 0);
  const totalAbsent = rows.reduce((n, r) => n + r.absent, 0);
  const totalRecorded = rows.reduce((n, r) => n + r.totalRecorded, 0);
  const teamRate = totalRecorded > 0
    ? ((rows.reduce((n, r) => n + r.present + r.halfDay * 0.5, 0)) / totalRecorded) * 100
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Attendance Reports</h1>
        <PeriodSelect period={period} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Present (days)" value={totalPresent.toString()} />
        <StatCard label="Absent (days)" value={totalAbsent.toString()} tone={totalAbsent > 0 ? "negative" : "neutral"} />
        <StatCard label="Days Recorded" value={totalRecorded.toString()} />
        <StatCard label="Team Attendance Rate" value={teamRate !== null ? `${teamRate.toFixed(0)}%` : "—"} />
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Employee</th>
              <th className="text-right px-3 py-2 font-medium text-neutral-600">Present</th>
              <th className="text-right px-3 py-2 font-medium text-neutral-600">Absent</th>
              <th className="text-right px-3 py-2 font-medium text-neutral-600">Half Day</th>
              <th className="text-right px-3 py-2 font-medium text-neutral-600">Leave</th>
              <th className="text-right px-3 py-2 font-medium text-neutral-600">Days Recorded</th>
              <th className="text-right px-3 py-2 font-medium text-neutral-600">Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.employeeId} className="border-t border-neutral-100">
                <td className="px-3 py-2 font-medium">{r.employeeName}</td>
                <td className="px-3 py-2 text-right">{r.present}</td>
                <td className={`px-3 py-2 text-right ${r.absent > 0 ? "text-red-600" : ""}`}>{r.absent}</td>
                <td className="px-3 py-2 text-right">{r.halfDay}</td>
                <td className="px-3 py-2 text-right">{r.leave}</td>
                <td className="px-3 py-2 text-right">{r.totalRecorded}</td>
                <td className="px-3 py-2 text-right font-medium">{r.attendanceRate !== null ? `${r.attendanceRate.toFixed(0)}%` : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-neutral-400">No active employees.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
