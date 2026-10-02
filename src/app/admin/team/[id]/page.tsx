import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatRs } from "@/lib/format";

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "—";
}

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      salaryPayments: { orderBy: { date: "desc" }, take: 20 },
      attendanceRecords: { orderBy: { date: "desc" }, take: 30 },
    },
  });
  if (!employee) notFound();

  const totalPaid = employee.salaryPayments.reduce((sum, p) => sum + p.amount, 0);
  const presentDays = employee.attendanceRecords.filter((a) => a.status === "PRESENT").length;
  const absentDays = employee.attendanceRecords.filter((a) => a.status === "ABSENT").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {employee.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={employee.photoUrl} alt={employee.name} className="w-16 h-16 object-cover rounded-md border border-neutral-200" />
          )}
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">{employee.name}</h1>
            <p className="text-sm text-neutral-500">
              {employee.position ?? "—"} {employee.active ? "" : "· Inactive"}
            </p>
          </div>
        </div>
        <Link href="/admin/team" className="link-btn">← Back to Team</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Phone</div>
          <div className="text-lg font-semibold mt-1">{employee.phone ?? "—"}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Monthly Salary</div>
          <div className="text-lg font-semibold mt-1">{employee.monthlySalary != null ? formatRs(employee.monthlySalary) : "—"}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Join Date</div>
          <div className="text-lg font-semibold mt-1">{fmtDate(employee.joinDate)}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Total Paid (recent)</div>
          <div className="text-lg font-semibold mt-1">{formatRs(totalPaid)}</div>
        </div>
      </div>

      {employee.notes && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4 text-sm text-neutral-600">{employee.notes}</div>
      )}

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-neutral-900">Salary Payments</h2>
          <Link href="/entry/team/salary" className="link-btn link-btn-primary">+ Record Payment</Link>
        </div>
        {employee.salaryPayments.length === 0 ? (
          <p className="text-sm text-neutral-400">No payments recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-neutral-500">
                <th className="text-left py-1 font-normal">Date</th>
                <th className="text-left py-1 font-normal">For Month</th>
                <th className="text-left py-1 font-normal">Mode</th>
                <th className="text-right py-1 font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              {employee.salaryPayments.map((p) => (
                <tr key={p.id} className="border-t border-neutral-100">
                  <td className="py-1">{fmtDate(p.date)}</td>
                  <td className="py-1">{p.forMonth ?? "—"}</td>
                  <td className="py-1">{p.mode}</td>
                  <td className="py-1 text-right">{formatRs(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-neutral-900">Attendance (recent 30)</h2>
          <Link href="/entry/team/attendance" className="link-btn link-btn-primary">+ Mark Attendance</Link>
        </div>
        <p className="text-sm text-neutral-600 mb-2">
          {presentDays} present · {absentDays} absent (of {employee.attendanceRecords.length} recorded)
        </p>
        {employee.attendanceRecords.length === 0 ? (
          <p className="text-sm text-neutral-400">No attendance recorded yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {employee.attendanceRecords.map((a) => (
              <span
                key={a.id}
                title={`${fmtDate(a.date)}: ${a.status}`}
                className={`text-xs rounded px-2 py-1 border ${
                  a.status === "PRESENT"
                    ? "border-primary-light bg-primary-light text-primary-dark"
                    : a.status === "ABSENT"
                      ? "border-danger-light bg-danger-light text-danger"
                      : "border-warning-light bg-warning-light text-warning"
                }`}
              >
                {fmtDate(a.date).slice(5)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
