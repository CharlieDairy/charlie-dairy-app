"use server";

import { prisma } from "@/lib/prisma";
import { saveUploadedImage, deleteUploadedImage } from "@/lib/uploadImage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqId, reqNum, reqText, optDate, optEnum, optNum, optText, CASH_MODES } from "@/lib/validate";

export type FormState = { success: boolean; message: string } | undefined;

const SALARY_CATEGORY = "Opex Salaries"; // matches this farm's existing real cash-ledger category
const ATTENDANCE = ["PRESENT", "ABSENT", "HALF_DAY", "LEAVE"] as const;

function refreshAttendance() {
  revalidatePath("/admin/team");
  revalidatePath("/entry/team/attendance");
  revalidatePath("/admin/team/attendance-calendar");
  revalidatePath("/admin/team/attendance-reports");
}

export async function addEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => addEmployeeImpl(formData));
}

async function addEmployeeImpl(formData: FormData): Promise<FormState> {
  await requirePermission("team", "CREATE");
  const name = reqText(formData, "name", "Name", { max: 100 });
  const position = optText(formData, "position", "Position", { max: 100 });
  const phone = optText(formData, "phone", "Phone", { max: 30 });
  const monthlySalary = optNum(formData, "monthlySalary", "Monthly salary", { max: 100_000_000 });
  const joinDate = optDate(formData, "joinDate", "Join date");
  const notes = optText(formData, "notes", "Notes", { max: 1000 });
  const photoField = formData.get("photo");
  const photo = photoField instanceof File ? photoField : null;

  let photoUrl: string | null = null;
  if (photo && photo.size > 0) {
    const uploaded = await saveUploadedImage(photo, "employees");
    if (uploaded.error) return { success: false, message: uploaded.error };
    photoUrl = uploaded.url;
  }

  let employee;
  try {
    employee = await prisma.employee.create({
      data: { name, position, phone, monthlySalary, joinDate, notes, photoUrl },
    });
  } catch (e) {
    await deleteUploadedImage(photoUrl);
    throw e;
  }

  revalidatePath("/admin/team");
  redirect(`/admin/team/${employee.id}`);
}

export async function updateEmployeeActive(formData: FormData): Promise<void> {
  await requirePermission("team", "EDIT");
  const id = reqId(formData, "id", "Employee");
  const active = formData.get("active") === "true";
  await prisma.employee.updateMany({ where: { id }, data: { active } });
  revalidatePath("/admin/team");
}

// Mirrors recordCustomerPayment's pattern (src/app/admin/reports/milk-sales/actions.ts):
// always creates a linked CashTransaction in the same transaction, so this
// money is never a parallel, untracked number -- it shows up in Cash Flow
// and P&L immediately, filed under this farm's existing "Opex Salaries"
// category.
export async function recordSalaryPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => recordSalaryPaymentImpl(formData));
}

async function recordSalaryPaymentImpl(formData: FormData): Promise<FormState> {
  const user = await requirePermission("team", "CREATE");
  const employeeId = reqId(formData, "employeeId", "Employee");
  const date = reqDate(formData, "date", "Date");
  const amount = reqNum(formData, "amount", "Amount", { positive: true, max: 100_000_000 });
  const forMonth = optText(formData, "forMonth", "For month", { max: 30 });
  const mode = optEnum(formData, "mode", "Payment mode", CASH_MODES) ?? "CASH";
  const notes = optText(formData, "notes", "Notes", { max: 500 });

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return { success: false, message: "Employee not found." };

  const duplicate = await prisma.salaryPayment.findFirst({
    where: { employeeId, date, amount, createdAt: { gte: new Date(Date.now() - 120_000) } },
    select: { id: true },
  });
  if (duplicate) throw new ValidationError("This salary payment was just recorded, so it wasn't saved twice.");

  const enteredBy = user.name;

  await prisma.$transaction(async (tx) => {
    const cashTx = await tx.cashTransaction.create({
      data: {
        date,
        party: employee.name,
        category: SALARY_CATEGORY,
        mode,
        amountOut: amount,
        enteredBy,
        remark: forMonth ? `Salary for ${employee.name} — ${forMonth}` : `Salary for ${employee.name}`,
      },
    });

    await tx.salaryPayment.create({
      data: { employeeId, date, amount, forMonth, mode, notes, cashTransactionId: cashTx.id, enteredBy },
    });
  });

  revalidatePath("/admin/team");
  revalidatePath(`/admin/team/${employeeId}`);
  revalidatePath("/admin/reports/cashflow");
  revalidatePath("/admin/reports/pl");
  revalidatePath("/admin");
  return { success: true, message: `Salary of Rs ${amount.toLocaleString()} recorded for ${employee.name}.` };
}

export async function markAttendance(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => markAttendanceImpl(formData));
}

async function markAttendanceImpl(formData: FormData): Promise<FormState> {
  const user = await requirePermission("team", "CREATE");
  const date = reqDate(formData, "date", "Date");
  const employeeIds = formData.getAll("employeeId").filter((v): v is string => typeof v === "string");
  if (employeeIds.length === 0) {
    return { success: false, message: "At least one employee is required." };
  }
  if (employeeIds.length > 300) throw new ValidationError("Too many employees in one submission.");

  const enteredBy = user.name;
  const rows = employeeIds.map((employeeId) => {
    const status = optEnum(formData, `status_${employeeId}`, "Attendance status", ATTENDANCE) ?? "PRESENT";
    return { employeeId: reqIdValue(employeeId), status };
  });

  await prisma.$transaction(
    rows.map(({ employeeId, status }) =>
      prisma.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId, date } },
        update: { status, enteredBy },
        create: { employeeId, date, status, enteredBy },
      })
    )
  );

  refreshAttendance();
  return { success: true, message: "Attendance saved." };
}

function reqIdValue(v: string): string {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(v)) throw new ValidationError("Employee is not valid.");
  return v;
}

// A one-tap shortcut for the common case (someone didn't show up) so
// marking it doesn't require opening the full team-wide daily form and
// stepping through every other employee's dropdown just to flag one person.
export async function markAbsence(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => markAbsenceImpl(formData));
}

async function markAbsenceImpl(formData: FormData): Promise<FormState> {
  const user = await requirePermission("team", "CREATE");
  const employeeId = reqId(formData, "employeeId", "Employee");
  const date = reqDate(formData, "date", "Date");

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { name: true } });
  if (!employee) return { success: false, message: "Employee not found." };

  const enteredBy = user.name;

  await prisma.attendanceRecord.upsert({
    where: { employeeId_date: { employeeId, date } },
    update: { status: "ABSENT", enteredBy },
    create: { employeeId, date, status: "ABSENT", enteredBy },
  });

  refreshAttendance();
  return { success: true, message: `${employee.name} marked absent for ${date.toISOString().slice(0, 10)}.` };
}

