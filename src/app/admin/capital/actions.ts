"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAccess, requirePermission, assertNotBackdated, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqEnum, reqId, reqNum, reqText, optText } from "@/lib/validate";

export type FormState = { success: boolean; message: string } | undefined;

const DIRECTIONS = ["CONTRIBUTION", "WITHDRAWAL"] as const;

export async function addCapitalEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => addCapitalEntryImpl(formData));
}

async function addCapitalEntryImpl(formData: FormData): Promise<FormState> {
  const user = await requirePermission("financial", "CREATE");

  const date = reqDate(formData, "date", "Date");
  assertNotBackdated(date, user, "Date");
  const partner = reqText(formData, "partner", "Partner", { max: 100 });
  const description = reqText(formData, "description", "Description", { max: 300 });
  const direction = reqEnum(formData, "direction", "Direction", DIRECTIONS);
  const amount = reqNum(formData, "amount", "Amount", { positive: true });
  const venture = optText(formData, "venture", "Venture", { max: 100 });

  const credit = direction === "CONTRIBUTION" ? amount : 0;
  const debit = direction === "WITHDRAWAL" ? amount : 0;

  const duplicate = await prisma.capitalEntry.findFirst({
    where: { date, partner, description, credit, debit, createdAt: { gte: new Date(Date.now() - 120_000) } },
    select: { id: true },
  });
  if (duplicate) {
    throw new ValidationError("This looks identical to an entry saved moments ago, so it wasn't saved twice.");
  }

  await prisma.capitalEntry.create({
    data: { date, partner, description, type: direction, credit, debit, venture },
  });

  revalidatePath("/admin/capital");
  return { success: true, message: "Capital entry saved." };
}

export async function updateCapitalEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => updateCapitalEntryImpl(formData));
}

async function updateCapitalEntryImpl(formData: FormData): Promise<FormState> {
  await requireAccess({ admin: true });
  const id = reqId(formData, "id", "Entry");
  const date = reqDate(formData, "date", "Date");
  const partner = reqText(formData, "partner", "Partner", { max: 100 });
  const description = reqText(formData, "description", "Description", { max: 300 });
  const direction = reqEnum(formData, "direction", "Direction", DIRECTIONS);
  const amount = reqNum(formData, "amount", "Amount", { positive: true });
  const venture = optText(formData, "venture", "Venture", { max: 100 });

  const existing = await prisma.capitalEntry.findUnique({ where: { id } });
  if (!existing) return { success: false, message: "Entry not found." };

  const credit = direction === "CONTRIBUTION" ? amount : 0;
  const debit = direction === "WITHDRAWAL" ? amount : 0;

  await prisma.capitalEntry.update({
    where: { id },
    data: { date, partner, description, type: direction, credit, debit, venture },
  });

  revalidatePath("/admin/capital");
  return { success: true, message: "Capital entry updated." };
}

export async function deleteCapitalEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => deleteCapitalEntryImpl(formData));
}

async function deleteCapitalEntryImpl(formData: FormData): Promise<FormState> {
  await requireAccess({ admin: true });
  const id = reqId(formData, "id", "Entry");

  const existing = await prisma.capitalEntry.findUnique({ where: { id } });
  if (!existing) return { success: false, message: "Entry not found." };

  await prisma.capitalEntry.delete({ where: { id } });
  revalidatePath("/admin/capital");
  return { success: true, message: "Capital entry deleted." };
}

export type BulkDeleteState = { success: boolean; message: string } | undefined;

// Bulk delete is Admin-only -- checked here server-side (not just hidden in
// the UI), same conservative pattern as the Animal List / Assets bulk
// deletes: this ledger has no dependent-record guard to fall back on (an
// entry stands alone, nothing else references it), so the stricter role
// check is the only thing preventing a Financial-only user from wiping many
// rows in one click.
export async function deleteCapitalEntries(_prev: BulkDeleteState, formData: FormData): Promise<BulkDeleteState> {
  return runAction(() => deleteCapitalEntriesImpl(formData));
}

async function deleteCapitalEntriesImpl(formData: FormData): Promise<BulkDeleteState> {
  await requirePermission("financial", "DELETE");
  await requireAccess({ admin: true });

  const ids = formData.getAll("entryIds") as string[];
  if (ids.length === 0) return { success: false, message: "No entries selected." };

  const { count } = await prisma.capitalEntry.deleteMany({ where: { id: { in: ids } } });

  revalidatePath("/admin/capital");
  return { success: true, message: `Deleted ${count} entr${count === 1 ? "y" : "ies"}.` };
}
