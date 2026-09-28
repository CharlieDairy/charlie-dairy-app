import { prisma } from "@/lib/prisma";
import { compare, monthRanges, type Comparison } from "@/lib/compare";
import { periodRange, type PeriodKey } from "./herd";

export type TeamOverview = {
  totalEmployees: number;
  activeEmployees: number;
  salaryPaidThisMonth: Comparison;
  attendanceRateThisMonth: number | null; // percent PRESENT (incl. HALF_DAY as 0.5) of all marked days this month
};

function dayBounds(d: Date): { start: Date; end: Date } {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  return { start, end: start };
}

export async function getTeamOverview(referenceDate = new Date()): Promise<TeamOverview> {
  const { currentStart, nextStart, previousStart } = monthRanges(referenceDate);

  const [totalEmployees, activeEmployees, salaryCurrent, salaryPrevious, attendanceThisMonth] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { active: true } }),
    prisma.salaryPayment.aggregate({ where: { date: { gte: currentStart, lt: nextStart } }, _sum: { amount: true } }),
    prisma.salaryPayment.aggregate({ where: { date: { gte: previousStart, lt: currentStart } }, _sum: { amount: true } }),
    prisma.attendanceRecord.findMany({ where: { date: { gte: currentStart, lt: nextStart } }, select: { status: true } }),
  ]);

  let attendanceRateThisMonth: number | null = null;
  if (attendanceThisMonth.length > 0) {
    const score = attendanceThisMonth.reduce((sum, a) => {
      if (a.status === "PRESENT") return sum + 1;
      if (a.status === "HALF_DAY") return sum + 0.5;
      return sum;
    }, 0);
    attendanceRateThisMonth = (score / attendanceThisMonth.length) * 100;
  }

  return {
    totalEmployees,
    activeEmployees,
    salaryPaidThisMonth: compare(salaryCurrent._sum.amount ?? 0, salaryPrevious._sum.amount ?? 0),
    attendanceRateThisMonth,
  };
}

export type EmployeeRow = {
  id: string;
  name: string;
  position: string | null;
  phone: string | null;
  monthlySalary: number | null;
  active: boolean;
  photoUrl: string | null;
  presentTodayStatus: string | null;
};

export async function getEmployeeList(): Promise<EmployeeRow[]> {
  const { start } = dayBounds(new Date());
  const [employees, todayAttendance] = await Promise.all([
    prisma.employee.findMany({ orderBy: { name: "asc" } }),
    prisma.attendanceRecord.findMany({ where: { date: start } }),
  ]);
  const attendanceMap = new Map(todayAttendance.map((a) => [a.employeeId, a.status]));

  return employees.map((e) => ({
    id: e.id,
    name: e.name,
    position: e.position,
    phone: e.phone,
    monthlySalary: e.monthlySalary,
    active: e.active,
    photoUrl: e.photoUrl,
    presentTodayStatus: attendanceMap.get(e.id) ?? null,
  }));
}

export type AttendanceReportRow = {
  employeeId: string;
  employeeName: string;
  present: number;
  absent: number;
  halfDay: number;
  leave: number;
  totalRecorded: number;
  attendanceRate: number | null;
};

// Same scoring convention as getTeamOverview's attendanceRateThisMonth
// (PRESENT=1, HALF_DAY=0.5, ABSENT/LEAVE=0), just period-selectable and
// broken out per employee instead of one farm-wide number.
export async function getAttendanceReport(period: PeriodKey = "month"): Promise<AttendanceReportRow[]> {
  const range = periodRange(period);
  const [employees, records] = await Promise.all([
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.attendanceRecord.groupBy({
      by: ["employeeId", "status"],
      where: range ? { date: { gte: range.start, lt: range.end } } : undefined,
      _count: { _all: true },
    }),
  ]);

  const countMap = new Map<string, Record<string, number>>();
  for (const r of records) {
    if (!countMap.has(r.employeeId)) countMap.set(r.employeeId, {});
    countMap.get(r.employeeId)![r.status] = r._count._all;
  }

  return employees.map((e) => {
    const c = countMap.get(e.id) ?? {};
    const present = c.PRESENT ?? 0;
    const absent = c.ABSENT ?? 0;
    const halfDay = c.HALF_DAY ?? 0;
    const leave = c.LEAVE ?? 0;
    const totalRecorded = present + absent + halfDay + leave;
    return {
      employeeId: e.id,
      employeeName: e.name,
      present,
      absent,
      halfDay,
      leave,
      totalRecorded,
      attendanceRate: totalRecorded > 0 ? ((present + halfDay * 0.5) / totalRecorded) * 100 : null,
    };
  });
}

export type AttendanceCalendarDay = "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | null;
export type AttendanceCalendarRow = {
  employeeId: string;
  employeeName: string;
  days: AttendanceCalendarDay[];
  presentCount: number;
  absentCount: number;
};

export async function getAttendanceCalendar(year: number, month: number): Promise<{ dayNumbers: number[]; rows: AttendanceCalendarRow[] }> {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const [employees, records] = await Promise.all([
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.attendanceRecord.findMany({ where: { date: { gte: start, lt: end } }, select: { employeeId: true, date: true, status: true } }),
  ]);

  const byEmployee = new Map<string, Map<number, AttendanceCalendarDay>>();
  for (const r of records) {
    if (!byEmployee.has(r.employeeId)) byEmployee.set(r.employeeId, new Map());
    byEmployee.get(r.employeeId)!.set(r.date.getUTCDate(), r.status);
  }

  const rows = employees.map((e) => {
    const dayMap = byEmployee.get(e.id) ?? new Map<number, AttendanceCalendarDay>();
    const days = dayNumbers.map((d) => dayMap.get(d) ?? null);
    return {
      employeeId: e.id,
      employeeName: e.name,
      days,
      presentCount: days.filter((d) => d === "PRESENT").length,
      absentCount: days.filter((d) => d === "ABSENT").length,
    };
  });

  return { dayNumbers, rows };
}
