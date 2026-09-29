"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess, requirePermission, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqEnum, reqId, reqNum, reqText, optEnum, optText, CASH_MODES, DIRECTIONS } from "@/lib/validate";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

function refresh() {
  revalidatePath("/entry/cash");
  revalidatePath("/admin/reports/cash-register");
  revalidatePath("/admin/reports/cashflow");
  revalidatePath("/admin/reports/pl");
  revalidatePath("/admin");
}

export async function submitCash(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => submitCashImpl(formData));
}

async function submitCashImpl(formData: FormData): Promise<FormState> {
  const user = await requirePermission("financial", "CREATE");

  const date = reqDate(formData, "date", "Date");
  const direction = reqEnum(formData, "direction", "Direction", DIRECTIONS); // "IN" | "OUT"
  const amount = reqNum(formData, "amount", "Amount", { positive: true });
  const category = reqText(formData, "category", "Category", { max: 100 });
  const mode = optEnum(formData, "mode", "Mode", CASH_MODES) ?? "CASH";
  const remark = optText(formData, "remark", "Remark", { max: 500 });
  const party = optText(formData, "party", "Party", { max: 100 });

  const amountIn = direction === "IN" ? amount : 0;
  const amountOut = direction === "OUT" ? amount : 0;

  // Double-tap / double-submit guard.
  const duplicate = await prisma.cashTransaction.findFirst({
    where: { date, category, party, mode, amountIn, amountOut, createdAt: { gte: new Date(Date.now() - 120_000) } },
    select: { id: true },
  });
  if (duplicate) {
    throw new ValidationError("This looks identical to an entry saved moments ago, so it wasn't saved twice.");
  }

  await prisma.cashTransaction.create({
    data: { date, category, party, remark, mode, amountIn, amountOut, enteredBy: user.name },
  });

  refresh();
  return { success: true, message: "Cash entry saved." };
}

export async function updateCashEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => updateCashEntryImpl(formData));
}

async function updateCashEntryImpl(formData: FormData): Promise<FormState> {
  await requirePermission("financial", "EDIT");
  const id = reqId(formData, "id", "Entry");
  const date = reqDate(formData, "date", "Date");
  const direction = reqEnum(formData, "direction", "Direction", DIRECTIONS);
  const amount = reqNum(formData, "amount", "Amount", { positive: true });
  const category = reqText(formData, "category", "Category", { max: 100 });
  const mode = optEnum(formData, "mode", "Mode", CASH_MODES) ?? "CASH";
  const remark = optText(formData, "remark", "Remark", { max: 500 });
  const party = optText(formData, "party", "Party", { max: 100 });

  const existing = await prisma.cashTransaction.findUnique({ where: { id } });
  if (!existing) return { success: false, message: "Entry not found." };

  const amountIn = direction === "IN" ? amount : 0;
  const amountOut = direction === "OUT" ? amount : 0;

  await prisma.cashTransaction.update({
    where: { id },
    data: { date, category, party, remark, mode, amountIn, amountOut },
  });

  refresh();
  return { success: true, message: "Cash entry updated." };
}

export async function deleteCashEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => deleteCashEntryImpl(formData));
}

async function deleteCashEntryImpl(formData: FormData): Promise<FormState> {
  await requirePermission("financial", "DELETE");
  const id = reqId(formData, "id", "Entry");

  const existing = await prisma.cashTransaction.findUnique({ where: { id } });
  if (!existing) return { success: false, message: "Entry not found." };

  await prisma.cashTransaction.delete({ where: { id } });
  refresh();
  return { success: true, message: "Cash entry deleted." };
}

export type BulkDeleteState = { success: boolean; message: string } | undefined;

// Bulk delete is Admin-only -- same conservative pattern as Capital Ledger's
// bulk delete: a cash transaction has no dependent-record guard to fall
// back on, so the stricter role check is the only thing standing between a
// Financial-only user and wiping many rows at once.
export async function deleteCashEntries(_prev: BulkDeleteState, formData: FormData): Promise<BulkDeleteState> {
  return runAction(() => deleteCashEntriesImpl(formData));
}

async function deleteCashEntriesImpl(formData: FormData): Promise<BulkDeleteState> {
  await requirePermission("financial", "DELETE");
  await requireAccess({ admin: true });

  const ids = formData.getAll("entryIds") as string[];
  if (ids.length === 0) return { success: false, message: "No entries selected." };

  const { count } = await prisma.cashTransaction.deleteMany({ where: { id: { in: ids } } });

  refresh();
  return { success: true, message: `Deleted ${count} entr${count === 1 ? "y" : "ies"}.` };
}
