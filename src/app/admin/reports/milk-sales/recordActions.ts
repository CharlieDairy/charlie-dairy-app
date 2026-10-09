"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, assertDateChangeNotBackdated, runAction } from "@/lib/access";
import { reqDate, reqEnum, reqId, reqNum, optEnum, optText, CASH_MODES, MILK_USE_TYPES } from "@/lib/validate";
import { revalidatePath } from "next/cache";

// Edit and delete for customer payments and milk internal use. Admin and
// Editor may both do this; an Editor cannot move a record onto a past date.

export type FormState = { success: boolean; message: string } | undefined;

const gone: FormState = { success: false, message: "That record no longer exists. Refresh the page." };

function refresh() {
  revalidatePath("/admin/reports/milk-sales");
  revalidatePath("/admin/reports/reconciliation");
  revalidatePath("/admin/reports/cash-register");
  revalidatePath("/admin/reports/cashflow");
  revalidatePath("/admin/reports/pl");
  revalidatePath("/admin/reports/ar-aging");
  revalidatePath("/admin/customers");
  revalidatePath("/admin");
}

// A customer payment owns a Cash Register row (see recordCustomerPayment);
// both change together in one transaction.
export async function updateCustomerPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await requirePermission("milk", "EDIT");
    const id = reqId(formData, "id", "Payment");
    const date = reqDate(formData, "date", "Date");
    const amount = reqNum(formData, "amount", "Amount", { positive: true, max: 1_000_000_000 });
    const mode = optEnum(formData, "mode", "Payment mode", CASH_MODES) ?? "CASH";
    const notes = optText(formData, "notes", "Notes", { max: 500 });

    const existing = await prisma.customerPayment.findUnique({ where: { id } });
    if (!existing) return gone;
    assertDateChangeNotBackdated(date, existing.date, user);

    await prisma.$transaction(async (tx) => {
      await tx.customerPayment.update({ where: { id }, data: { date, amount, mode, notes } });
      if (existing.cashTransactionId) {
        await tx.cashTransaction.update({
          where: { id: existing.cashTransactionId },
          data: {
            date,
            amountIn: amount,
            mode,
            remark: notes ? `Milk sale payment from ${existing.buyer}: ${notes}` : `Milk sale payment from ${existing.buyer}`,
          },
        });
      }
    });
    refresh();
    return { success: true, message: "Payment updated." };
  });
}

export async function deleteCustomerPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await requirePermission("milk", "DELETE");
    const id = reqId(formData, "id", "Payment");
    const existing = await prisma.customerPayment.findUnique({ where: { id } });
    if (!existing) return gone;
    await prisma.$transaction(async (tx) => {
      await tx.customerPayment.delete({ where: { id } });
      if (existing.cashTransactionId) await tx.cashTransaction.deleteMany({ where: { id: existing.cashTransactionId } });
    });
    refresh();
    return { success: true, message: "Payment deleted, along with its Cash Register entry." };
  });
}

export async function updateMilkUsage(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await requirePermission("milk", "EDIT");
    const id = reqId(formData, "id", "Record");
    const date = reqDate(formData, "date", "Date");
    const type = reqEnum(formData, "type", "Use", MILK_USE_TYPES);
    const litres = reqNum(formData, "litres", "Litres", { positive: true, max: 100_000 });
    const notes = optText(formData, "notes", "Notes", { max: 500 });
    const existing = await prisma.milkUsageRecord.findUnique({ where: { id } });
    if (!existing) return gone;
    assertDateChangeNotBackdated(date, existing.date, user);
    await prisma.milkUsageRecord.update({ where: { id }, data: { date, type, litres, notes } });
    refresh();
    return { success: true, message: "Milk use updated." };
  });
}

export async function deleteMilkUsage(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await requirePermission("milk", "DELETE");
    const id = reqId(formData, "id", "Record");
    const { count } = await prisma.milkUsageRecord.deleteMany({ where: { id } });
    if (count === 0) return gone;
    refresh();
    return { success: true, message: "Milk use deleted." };
  });
}
