"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, assertDateChangeNotBackdated, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqEnum, reqId, reqNum, reqText, optDate, optEnum, optNum, optText, CASH_MODES } from "@/lib/validate";
import { revalidatePath } from "next/cache";

// Edit and delete for salary payments and attendance. Admin and Editor may
// both do this; an Editor cannot move a record onto a past date.

export type FormState = { success: boolean; message: string } | undefined;

const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "HALF_DAY", "LEAVE"] as const;
const gone: FormState = { success: false, message: "That record no longer exists. Refresh the page." };

function refresh(employeeId: string) {
  revalidatePath("/admin/team");
  revalidatePath(`/admin/team/${employeeId}`);
  revalidatePath("/admin/team/attendance-calendar");
  revalidatePath("/admin/team/attendance-reports");
  revalidatePath("/entry/team/attendance");
  revalidatePath("/admin/reports/cash-register");
  revalidatePath("/admin/reports/cashflow");
  revalidatePath("/admin/reports/pl");
  revalidatePath("/admin");
}

// A salary payment owns a Cash Register row (see recordSalaryPayment). Edit
// and delete move both together in one transaction so the two never disagree.
export async function updateSalaryPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await requirePermission("team", "EDIT");
    const id = reqId(formData, "id", "Payment");
    const date = reqDate(formData, "date", "Date");
    const amount = reqNum(formData, "amount", "Amount", { positive: true, max: 100_000_000 });
    const forMonth = optText(formData, "forMonth", "For month", { max: 30 });
    const mode = optEnum(formData, "mode", "Payment mode", CASH_MODES) ?? "CASH";
    const notes = optText(formData, "notes", "Notes", { max: 500 });

    const existing = await prisma.salaryPayment.findUnique({ where: { id }, include: { employee: { select: { name: true } } } });
    if (!existing) return gone;
    assertDateChangeNotBackdated(date, existing.date, user);

    await prisma.$transaction(async (tx) => {
      await tx.salaryPayment.update({ where: { id }, data: { date, amount, forMonth, mode, notes } });
      if (existing.cashTransactionId) {
        await tx.cashTransaction.update({
          where: { id: existing.cashTransactionId },
          data: {
            date,
            amountOut: amount,
            mode,
            remark: forMonth ? `Salary for ${existing.employee.name} — ${forMonth}` : `Salary for ${existing.employee.name}`,
          },
        });
      }
    });
    refresh(existing.employeeId);
    return { success: true, message: "Salary payment updated." };
  });
}

export async function deleteSalaryPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await requirePermission("team", "DELETE");
    const id = reqId(formData, "id", "Payment");
    const existing = await prisma.salaryPayment.findUnique({ where: { id } });
    if (!existing) return gone;
    await prisma.$transaction(async (tx) => {
      await tx.salaryPayment.delete({ where: { id } });
      if (existing.cashTransactionId) await tx.cashTransaction.deleteMany({ where: { id: existing.cashTransactionId } });
    });
    refresh(existing.employeeId);
    return { success: true, message: "Salary payment deleted, along with its Cash Register entry." };
  });
}

// Attendance is one record per employee per day, so the date itself is fixed;
// the status and note can change.
export async function updateAttendance(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await requirePermission("team", "EDIT");
    const id = reqId(formData, "id", "Record");
    const status = reqEnum(formData, "status", "Status", ATTENDANCE_STATUSES);
    const notes = optText(formData, "notes", "Notes", { max: 500 });
    const existing = await prisma.attendanceRecord.findUnique({ where: { id }, select: { employeeId: true } });
    if (!existing) return gone;
    await prisma.attendanceRecord.update({ where: { id }, data: { status, notes } });
    refresh(existing.employeeId);
    return { success: true, message: "Attendance updated." };
  });
}

export async function deleteAttendance(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await requirePermission("team", "DELETE");
    const id = reqId(formData, "id", "Record");
    const existing = await prisma.attendanceRecord.findUnique({ where: { id }, select: { employeeId: true } });
    if (!existing) return gone;
    await prisma.attendanceRecord.delete({ where: { id } });
    refresh(existing.employeeId);
    return { success: true, message: "Attendance record deleted." };
  });
}

// ---- Employee record itself -------------------------------------------------

export async function updateEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await requirePermission("team", "EDIT");
    const id = reqId(formData, "id", "Employee");
    const name = reqText(formData, "name", "Name", { max: 100 });
    const position = optText(formData, "position", "Position", { max: 100 });
    const phone = optText(formData, "phone", "Phone", { max: 40 });
    const monthlySalary = optNum(formData, "monthlySalary", "Monthly salary", { max: 100_000_000 });
    const joinDate = optDate(formData, "joinDate", "Join date");
    const notes = optText(formData, "notes", "Notes", { max: 1000 });
    const existing = await prisma.employee.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return gone;
    await prisma.employee.update({ where: { id }, data: { name, position, phone, monthlySalary, joinDate, notes } });
    refresh(id);
    return { success: true, message: "Employee updated." };
  });
}

export async function deleteEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await requirePermission("team", "DELETE");
    const id = reqId(formData, "id", "Employee");
    const existing = await prisma.employee.findUnique({
      where: { id },
      select: { name: true, _count: { select: { salaryPayments: true, attendanceRecords: true } } },
    });
    if (!existing) return gone;
    if (existing._count.salaryPayments > 0 || existing._count.attendanceRecords > 0) {
      throw new ValidationError(`${existing.name} has salary or attendance history, so can't be deleted. Mark them Inactive instead to keep the history.`);
    }
    await prisma.employee.delete({ where: { id } });
    refresh(id);
    return { success: true, message: "Employee deleted." };
  });
}
