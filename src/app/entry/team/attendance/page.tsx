import { prisma } from "@/lib/prisma";
import AttendanceForm from "./AttendanceForm";

function todayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

export default async function AttendanceEntryPage() {
  const today = todayBounds();
  const [employees, todayRecords] = await Promise.all([
    prisma.employee.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.attendanceRecord.findMany({ where: { date: today } }),
  ]);
  const existing = new Map(todayRecords.map((r) => [r.employeeId, r.status]));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900">Attendance</h1>
      <p className="text-sm text-neutral-500">Mark today&apos;s attendance for every active employee in one go.</p>
      <AttendanceForm employees={employees} existing={existing} />
    </div>
  );
}
