"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, assertNotBackdated, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqNum, reqText, optEnum, optText, CASH_MODES } from "@/lib/validate";

export type FormState = { success: boolean; message: string } | undefined;

// Recording a payment always creates a linked CashTransaction in the same
// transaction, so this money is never a parallel, untracked number -- it
// shows up in the real Cash Flow / P&L immediately, exactly as the user
// asked ("linked to accounts").
export async function recordCustomerPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => recordCustomerPaymentImpl(formData));
}

async function recordCustomerPaymentImpl(formData: FormData): Promise<FormState> {
  const user = await requirePermission("milk", "CREATE");
  const typedBuyer = reqText(formData, "buyer", "Buyer", { max: 100 });
  const date = reqDate(formData, "date", "Date");
  assertNotBackdated(date, user, "Date");
  const amount = reqNum(formData, "amount", "Amount", { positive: true, max: 1_000_000_000 });
  const mode = optEnum(formData, "mode", "Payment mode", CASH_MODES) ?? "CASH";
  const notes = optText(formData, "notes", "Notes", { max: 500 });

  // Same rule as recording a sale: must be a registered customer, so
  // payments always land on the same customer their sales are under.
  const customer = await prisma.customer.findFirst({
    where: { name: { equals: typedBuyer, mode: "insensitive" } },
    select: { name: true },
  });
  if (!customer) throw new ValidationError("Select a registered customer — that name isn't in the Customers list.");
  const buyer = customer.name;

  const duplicate = await prisma.customerPayment.findFirst({
    where: { buyer, date, amount, createdAt: { gte: new Date(Date.now() - 120_000) } },
    select: { id: true },
  });
  if (duplicate) throw new ValidationError("This payment was just recorded, so it wasn't saved twice.");

  const enteredBy = user.name;

  await prisma.$transaction(async (tx) => {
    const cashTx = await tx.cashTransaction.create({
      data: {
        date,
        party: buyer,
        category: "Milk Sale Payment",
        mode,
        amountIn: amount,
        enteredBy,
        remark: notes ? `Milk sale payment from ${buyer}: ${notes}` : `Milk sale payment from ${buyer}`,
      },
    });

    await tx.customerPayment.create({
      data: { buyer, date, amount, mode, notes, cashTransactionId: cashTx.id, enteredBy },
    });
  });

  revalidatePath("/admin/reports/milk-sales");
  revalidatePath("/admin/reports/cashflow");
  revalidatePath("/admin/reports/pl");
  revalidatePath("/admin");
  return { success: true, message: `Payment of Rs ${amount.toLocaleString()} from ${buyer} recorded and added to cash accounts.` };
}
