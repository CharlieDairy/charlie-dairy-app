import { prisma } from "@/lib/prisma";
import { compare, monthRanges, type Comparison } from "@/lib/compare";

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
