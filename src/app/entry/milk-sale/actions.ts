"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, assertNotBackdated, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqId, reqNum, reqText, optEnum, SHIFTS } from "@/lib/validate";
import { revalidatePath } from "next/cache";
import { INTERNAL_USE_OPTIONS } from "./internalUse";

export type FormState = { success: boolean; message: string } | undefined;

type SaleFields = {
  date: Date;
  buyer: string;
  shift: (typeof SHIFTS)[number] | null;
  litres: number;
  rate: number;
  amount: number;
};

function refresh() {
  revalidatePath("/entry/milk-sale");
  revalidatePath("/admin/reports/milk-sales");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/reports/reconciliation");
}

// The customer's agreed rate is the ONLY source of truth for what a sale is
// priced at -- it's managed on the Customers page (Admin-only), not typed in
// on the sale itself, so a sale can never be recorded at a rate nobody
// approved. Buyer must match a real, active Customer; free-text buyers are
// no longer accepted here (Milk Sale Entry is now the only place milk
// disposition gets recorded, so every "buyer" is either a real customer or
// an internal-use entry on the same page, never an ad hoc name).
async function resolveCustomer(buyerName: string) {
  const customer = await prisma.customer.findFirst({
    where: { name: { equals: buyerName, mode: "insensitive" } },
    select: { id: true, name: true, agreedRate: true, active: true },
  });
  if (!customer) throw new ValidationError("Select a registered customer — that name isn't in the Customers list.");
  if (!customer.active) throw new ValidationError(`"${customer.name}" is hidden. Reactivate them on the Customers page first.`);
  if (customer.agreedRate === null) {
    throw new ValidationError(`"${customer.name}" has no agreed rate set. Add one on the Customers page before recording a sale.`);
  }
  return customer as { id: string; name: string; agreedRate: number; active: boolean };
}

// Shared by create and update so both apply the exact same rules.
async function readSale(formData: FormData): Promise<SaleFields> {
  const date = reqDate(formData, "date", "Date");
  const typedBuyer = reqText(formData, "buyer", "Customer", { max: 100 });
  const shift = optEnum(formData, "shift", "Shift", SHIFTS);
  const litres = reqNum(formData, "litres", "Litres", { positive: true, max: 100_000 });

  const customer = await resolveCustomer(typedBuyer);
  const rate = customer.agreedRate;
  const amount = Math.round(rate * litres * 100) / 100;

  return { date, buyer: customer.name, shift, litres, rate, amount };
}

export async function submitMilkSale(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => submitMilkSaleImpl(formData));
}

async function submitInternalUse(formData: FormData, user: { name: string }, option: (typeof INTERNAL_USE_OPTIONS)[number]) {
  const date = reqDate(formData, "date", "Date");
  const litres = reqNum(formData, "litres", "Litres", { positive: true, max: 100_000 });

  const duplicate = await prisma.milkUsageRecord.findFirst({
    where: { date, type: option.type, litres, createdAt: { gte: new Date(Date.now() - 120_000) } },
    select: { id: true },
  });
  if (duplicate) throw new ValidationError("This looks identical to an entry saved moments ago, so it wasn't saved twice.");

  await prisma.milkUsageRecord.create({ data: { date, type: option.type, litres, enteredBy: user.name } });
  return { date, litres };
}

async function submitMilkSaleImpl(formData: FormData): Promise<FormState> {
  const user = await requirePermission("milk", "CREATE");

  const typedBuyer = reqText(formData, "buyer", "Customer", { max: 100 });
  const internal = INTERNAL_USE_OPTIONS.find((o) => o.label.toLowerCase() === typedBuyer.toLowerCase());
  if (internal) {
    assertNotBackdated(reqDate(formData, "date", "Date"), user, "Date");
    const { litres } = await submitInternalUse(formData, user, internal);
    refresh();
    return { success: true, message: `${internal.label}: ${litres} L recorded.` };
  }

  const sale = await readSale(formData);
  assertNotBackdated(sale.date, user, "Sale date");

  const duplicate = await prisma.milkSale.findFirst({
    where: {
      date: sale.date,
      buyer: sale.buyer,
      shift: sale.shift,
      litres: sale.litres,
      amount: sale.amount,
      createdAt: { gte: new Date(Date.now() - 120_000) },
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new ValidationError("This looks identical to a sale saved moments ago, so it wasn't saved twice.");
  }

  await prisma.milkSale.create({
    data: {
      date: sale.date,
      buyer: sale.buyer,
      shift: sale.shift,
      litres: sale.litres,
      rate: sale.rate,
      amount: sale.amount,
      enteredBy: user.name,
    },
  });

  refresh();
  return { success: true, message: "Milk sale entry saved." };
}

// Editing a sale changes the farm's books after the fact -- only an Admin
// can override information already recorded (see access.ts assertNotBackdated
// for the matching rule on new entries).
export async function updateMilkSale(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => updateMilkSaleImpl(formData));
}

async function updateMilkSaleImpl(formData: FormData): Promise<FormState> {
  await requirePermission("milk", "EDIT");
  const id = reqId(formData, "id", "Sale");
  const sale = await readSale(formData);

  const existing = await prisma.milkSale.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { success: false, message: "That sale no longer exists. Refresh the page." };

  await prisma.milkSale.update({
    where: { id },
    data: {
      date: sale.date,
      buyer: sale.buyer,
      shift: sale.shift,
      litres: sale.litres,
      rate: sale.rate,
      amount: sale.amount,
    },
  });

  refresh();
  return { success: true, message: "Sale updated." };
}

export async function deleteMilkSale(formData: FormData): Promise<void> {
  await requirePermission("milk", "DELETE");
  const id = reqId(formData, "id", "Sale");
  // deleteMany: deleting a sale someone else already removed is a no-op, not a crash.
  await prisma.milkSale.deleteMany({ where: { id } });
  refresh();
}
