"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { saveUploadedImage } from "@/lib/uploadImage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type FormState = { success: boolean; message: string } | undefined;

const SALARY_CATEGORY = "Opex Salaries"; // matches this farm's existing real cash-ledger category

export async function addEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = (formData.get("name") as string | null)?.trim();
  const position = (formData.get("position") as string | null)?.trim() || null;
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const salaryRaw = formData.get("monthlySalary") as string | null;
  const joinDateRaw = formData.get("joinDate") as string | null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const photo = formData.get("photo") as File | null;

  if (!name) return { success: false, message: "Name is required." };

  const monthlySalary = salaryRaw ? parseFloat(salaryRaw) : null;

  let photoUrl: string | null = null;
  if (photo && photo.size > 0) {
    const uploaded = await saveUploadedImage(photo, "employees");
    if (uploaded.error) return { success: false, message: uploaded.error };
    photoUrl = uploaded.url;
  }

  const employee = await prisma.employee.create({
    data: {
      name,
      position,
      phone,
      monthlySalary: monthlySalary !== null && !Number.isNaN(monthlySalary) ? monthlySalary : null,
      joinDate: joinDateRaw ? new Date(joinDateRaw) : null,
      notes,
      photoUrl,
    },
  });

  revalidatePath("/admin/team");
  redirect(`/admin/team/${employee.id}`);
}

export async function updateEmployeeActive(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";
  await prisma.employee.update({ where: { id }, data: { active } });
  revalidatePath("/admin/team");
}

// Mirrors recordCustomerPayment's pattern (src/app/admin/reports/milk-sales/actions.ts):
// always creates a linked CashTransaction in the same transaction, so this
// money is never a parallel, untracked number -- it shows up in Cash Flow
// and P&L immediately, filed under this farm's existing "Opex Salaries"
// category.
export async function recordSalaryPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const employeeId = formData.get("employeeId") as string | null;
  const dateRaw = formData.get("date") as string | null;
  const amountRaw = formData.get("amount") as string | null;
  const forMonth = (formData.get("forMonth") as string | null)?.trim() || null;
  const mode = (formData.get("mode") as string | null) || "CASH";
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  const amount = amountRaw ? parseFloat(amountRaw) : NaN;
  if (!employeeId || !dateRaw || Number.isNaN(amount) || amount <= 0) {
    return { success: false, message: "Employee, date and a positive amount are required." };
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return { success: false, message: "Employee not found." };

  const date = new Date(dateRaw);
  const enteredBy = session?.user?.name ?? null;

  await prisma.$transaction(async (tx) => {
    const cashTx = await tx.cashTransaction.create({
      data: {
        date,
        party: employee.name,
        category: SALARY_CATEGORY,
        mode: mode as "CASH" | "BANK",
        amountOut: amount,
        enteredBy,
        remark: forMonth ? `Salary for ${employee.name} — ${forMonth}` : `Salary for ${employee.name}`,
      },
    });

    await tx.salaryPayment.create({
      data: {
        employeeId,
        date,
        amount,
        forMonth,
        mode: mode as "CASH" | "BANK",
        notes,
        cashTransactionId: cashTx.id,
        enteredBy,
      },
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
  const session = await auth();
  const dateRaw = formData.get("date") as string | null;
  const employeeIds = formData.getAll("employeeId") as string[];
  if (!dateRaw || employeeIds.length === 0) {
    return { success: false, message: "Date and at least one employee are required." };
  }

  const date = new Date(dateRaw);
  const enteredBy = session?.user?.name ?? null;

  await prisma.$transaction(
    employeeIds.map((employeeId) => {
      const status = (formData.get(`status_${employeeId}`) as string | null) || "PRESENT";
      return prisma.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId, date } },
        update: { status: status as "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE", enteredBy },
        create: { employeeId, date, status: status as "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE", enteredBy },
      });
    })
  );

  revalidatePath("/admin/team");
  revalidatePath("/entry/team/attendance");
  revalidatePath("/admin/team/attendance-calendar");
  revalidatePath("/admin/team/attendance-reports");
  return { success: true, message: "Attendance saved." };
}

// A one-tap shortcut for the common case (someone didn't show up) so
// marking it doesn't require opening the full team-wide daily form and
// stepping through every other employee's dropdown just to flag one person.
export async function markAbsence(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const employeeId = formData.get("employeeId") as string | null;
  const dateRaw = formData.get("date") as string | null;
  if (!employeeId || !dateRaw) {
    return { success: false, message: "Employee and date are required." };
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { name: true } });
  if (!employee) return { success: false, message: "Employee not found." };

  const date = new Date(dateRaw);
  const enteredBy = session?.user?.name ?? null;

  await prisma.attendanceRecord.upsert({
    where: { employeeId_date: { employeeId, date } },
    update: { status: "ABSENT", enteredBy },
    create: { employeeId, date, status: "ABSENT", enteredBy },
  });

  revalidatePath("/admin/team");
  revalidatePath("/entry/team/attendance");
  revalidatePath("/admin/team/attendance-calendar");
  revalidatePath("/admin/team/attendance-reports");
  return { success: true, message: `${employee.name} marked absent for ${dateRaw}.` };
}
