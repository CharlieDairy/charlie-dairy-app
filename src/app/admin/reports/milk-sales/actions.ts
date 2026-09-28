"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

// Recording a payment always creates a linked CashTransaction in the same
// transaction, so this money is never a parallel, untracked number -- it
// shows up in the real Cash Flow / P&L immediately, exactly as the user
// asked ("linked to accounts").
export async function recordCustomerPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const buyer = (formData.get("buyer") as string | null)?.trim();
  const dateRaw = formData.get("date") as string | null;
  const amountRaw = formData.get("amount") as string | null;
  const mode = (formData.get("mode") as string | null) || "CASH";
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  const amount = amountRaw ? parseFloat(amountRaw) : NaN;
  if (!buyer || !dateRaw || Number.isNaN(amount) || amount <= 0) {
    return { success: false, message: "Buyer, date and a positive amount are required." };
  }

  const date = new Date(dateRaw);
  const enteredBy = session?.user?.name ?? null;

  await prisma.$transaction(async (tx) => {
    const cashTx = await tx.cashTransaction.create({
      data: {
        date,
        party: buyer,
        category: "Milk Sale Payment",
        mode: mode as "CASH" | "BANK",
        amountIn: amount,
        enteredBy,
        remark: notes ? `Milk sale payment from ${buyer}: ${notes}` : `Milk sale payment from ${buyer}`,
      },
    });

    await tx.customerPayment.create({
      data: {
        buyer,
        date,
        amount,
        mode: mode as "CASH" | "BANK",
        notes,
        cashTransactionId: cashTx.id,
        enteredBy,
      },
    });
  });

  revalidatePath("/admin/reports/milk-sales");
  revalidatePath("/admin/reports/cashflow");
  revalidatePath("/admin/reports/pl");
  revalidatePath("/admin");
  return { success: true, message: `Payment of Rs ${amount.toLocaleString()} from ${buyer} recorded and added to cash accounts.` };
}

export type BulkDeleteState = { success: boolean; message: string } | undefined;

// Admin-only: a row here is a customer's full sales history, so selecting
// it always means clearing every MilkSale and CustomerPayment for that
// buyer -- there's no partial/safe subset like the Animal List's guard.
// A payment's linked CashTransaction is deleted too (never left as an
// orphaned receipt with no buyer behind it), same "linked to accounts"
// principle as recordCustomerPayment above.
export async function deleteCustomerSales(_prev: BulkDeleteState, formData: FormData): Promise<BulkDeleteState> {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return { success: false, message: "Only Admin can bulk-delete customer sales." };
  }

  const buyers = formData.getAll("buyers") as string[];
  if (buyers.length === 0) return { success: false, message: "No rows selected." };

  const result = await prisma.$transaction(async (tx) => {
    const sales = await tx.milkSale.deleteMany({ where: { buyer: { in: buyers } } });
    const payments = await tx.customerPayment.findMany({ where: { buyer: { in: buyers } }, select: { id: true, cashTransactionId: true } });
    const cashTxIds = payments.map((p) => p.cashTransactionId).filter((id): id is string => id !== null);
    await tx.customerPayment.deleteMany({ where: { buyer: { in: buyers } } });
    if (cashTxIds.length > 0) await tx.cashTransaction.deleteMany({ where: { id: { in: cashTxIds } } });
    return { salesCount: sales.count, paymentsCount: payments.length };
  });

  revalidatePath("/admin/reports/milk-sales");
  revalidatePath("/admin/reports/cashflow");
  revalidatePath("/admin/reports/pl");
  revalidatePath("/admin");
  return {
    success: true,
    message: `Deleted ${result.salesCount} sale${result.salesCount === 1 ? "" : "s"} and ${result.paymentsCount} payment${result.paymentsCount === 1 ? "" : "s"} for ${buyers.length} customer${buyers.length === 1 ? "" : "s"}.`,
  };
}
