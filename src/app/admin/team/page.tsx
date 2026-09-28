import Link from "next/link";
import { getTeamOverview, getEmployeeList } from "@/lib/reports/team";
import { formatRs } from "@/lib/format";
import StatCard from "@/components/StatCard";
import TrendStat from "@/components/TrendStat";
import EmployeeActiveToggle from "./EmployeeActiveToggle";

export default async function TeamPage() {
  const [overview, employees] = await Promise.all([getTeamOverview(), getEmployeeList()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Team</h1>
        <Link href="/admin/team/add" className="bg-green-700 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-green-800">
          + Add Employee
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Employees" value={overview.totalEmployees.toString()} />
        <StatCard label="Active" value={overview.activeEmployees.toString()} />
        <TrendStat label="Salary Paid This Month" value={formatRs(overview.salaryPaidThisMonth.current)} comparison={overview.salaryPaidThisMonth} />
        <StatCard
          label="Attendance Rate (Month)"
          value={overview.attendanceRateThisMonth !== null ? `${overview.attendanceRateThisMonth.toFixed(0)}%` : "—"}
        />
      </div>

      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2"></th>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Position</th>
              <th className="text-left px-3 py-2">Phone</th>
              <th className="text-right px-3 py-2">Monthly Salary</th>
              <th className="text-left px-3 py-2">Today</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-t border-neutral-100">
                <td className="px-3 py-2">
                  {e.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.photoUrl} alt={e.name} className="w-8 h-8 object-cover rounded-full border border-neutral-200" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200" />
                  )}
                </td>
                <td className="px-3 py-2 font-medium">
                  <Link href={`/admin/team/${e.id}`} className="text-primary hover:underline">{e.name}</Link>
                </td>
                <td className="px-3 py-2">{e.position ?? "—"}</td>
                <td className="px-3 py-2">{e.phone ?? "—"}</td>
                <td className="px-3 py-2 text-right">{e.monthlySalary != null ? formatRs(e.monthlySalary) : "—"}</td>
                <td className="px-3 py-2">{e.presentTodayStatus ?? "—"}</td>
                <td className="px-3 py-2">{e.active ? "Active" : "Inactive"}</td>
                <td className="px-3 py-2">
                  <EmployeeActiveToggle id={e.id} active={e.active} />
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-neutral-500">No employees added yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
