import Link from "next/link";
import { getAttendanceCalendar, type AttendanceCalendarDay } from "@/lib/reports/team";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function cellClass(status: AttendanceCalendarDay): string {
  if (status === "PRESENT") return "bg-green-100 text-green-800";
  if (status === "ABSENT") return "bg-red-100 text-red-700";
  if (status === "HALF_DAY") return "bg-amber-100 text-amber-800";
  if (status === "LEAVE") return "bg-sky-100 text-sky-800";
  return "text-neutral-300";
}

function cellLabel(status: AttendanceCalendarDay): string {
  if (status === "PRESENT") return "P";
  if (status === "ABSENT") return "A";
  if (status === "HALF_DAY") return "H";
  if (status === "LEAVE") return "L";
  return "·";
}

export default async function AttendanceCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1; // 1-12

  const { dayNumbers, rows } = await getAttendanceCalendar(year, month);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Attendance Calendar</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href={`?year=${prevYear}&month=${prevMonth}`} className="px-3 py-1.5 border border-neutral-300 rounded-md hover:bg-neutral-100">
            ← Previous
          </Link>
          <span className="font-medium">{MONTH_NAMES[month - 1]} {year}</span>
          <Link href={`?year=${nextYear}&month=${nextMonth}`} className="px-3 py-1.5 border border-neutral-300 rounded-md hover:bg-neutral-100">
            Next →
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-neutral-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 inline-block" /> Present</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 inline-block" /> Absent</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 inline-block" /> Half Day</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-sky-100 inline-block" /> Leave</span>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg overflow-x-auto">
        <table className="text-xs">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-neutral-600 sticky left-0 bg-neutral-100">Employee</th>
              {dayNumbers.map((d) => (
                <th key={d} className="w-7 text-center py-2 font-medium text-neutral-500">{d}</th>
              ))}
              <th className="text-right px-3 py-2 font-medium text-neutral-600">Present</th>
              <th className="text-right px-3 py-2 font-medium text-neutral-600">Absent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.employeeId} className="border-t border-neutral-100">
                <td className="px-3 py-1.5 font-medium whitespace-nowrap sticky left-0 bg-white">{r.employeeName}</td>
                {r.days.map((status, i) => (
                  <td key={i} className="text-center py-1.5">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded ${cellClass(status)}`}>
                      {cellLabel(status)}
                    </span>
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right font-medium">{r.presentCount}</td>
                <td className={`px-3 py-1.5 text-right ${r.absentCount > 0 ? "text-red-600 font-medium" : ""}`}>{r.absentCount}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={dayNumbers.length + 3} className="px-3 py-6 text-center text-neutral-400">No active employees.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
