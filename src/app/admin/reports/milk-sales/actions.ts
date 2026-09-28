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
