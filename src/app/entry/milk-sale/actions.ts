"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqId, reqNum, reqText, optEnum, optNum, SHIFTS } from "@/lib/validate";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

type SaleFields = {
  date: Date;
  buyer: string;
  shift: (typeof SHIFTS)[number] | null;
  litres: number;
  rate: number | null;
  amount: number;
};

// Shared by create and update so both apply the exact same rules.
async function readSale(formData: FormData): Promise<SaleFields> {
  const date = reqDate(formData, "date", "Date");
  const typedBuyer = reqText(formData, "buyer", "Buyer", { max: 100 });
  const shift = optEnum(formData, "shift", "Shift", SHIFTS);
  const litres = reqNum(formData, "litres", "Litres", { positive: true, max: 100_000 });
  const rate = optNum(formData, "rate", "Rate", { positive: true, max: 10_000 });
  let amount = optNum(formData, "amount", "Amount", { max: 1_000_000_000 });

  if (amount === null) {
    if (rate === null) throw new ValidationError("Enter either a rate or an amount.");
    amount = Math.round(rate * litres * 100) / 100;
  } else if (rate !== null) {
    // Catches the classic extra-zero typo without blocking small negotiated rounding.
    const expected = rate * litres;
    if (Math.abs(amount - expected) > Math.max(5, expected * 0.05)) {
      throw new ValidationError(
        `Amount (Rs ${amount.toLocaleString("en-PK")}) doesn't match litres × rate (Rs ${Math.round(expected).toLocaleString("en-PK")}). Please check.`
      );
    }
  }

  // Use the customer's canonical spelling so reports don't split one buyer into two.
  const customer = await prisma.customer.findFirst({
    where: { name: { equals: typedBuyer, mode: "insensitive" } },
    select: { name: true },
  });

  return { date, buyer: customer?.name ?? typedBuyer, shift, litres, rate, amount };
}

export async function submitMilkSale(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => submitMilkSaleImpl(formData));
}

async function submitMilkSaleImpl(formData: FormData): Promise<FormState> {
  const user = await requireAccess({ module: "OPERATIONS" });
  const sale = await readSale(formData);

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
      rate: sale.rate ?? undefined,
      amount: sale.amount,
      enteredBy: user.name,
    },
  });

  revalidatePath("/entry/milk-sale");
  revalidatePath("/admin/reports/milk-sales");
  return { success: true, message: "Milk sale entry saved." };
}

export async function updateMilkSale(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => updateMilkSaleImpl(formData));
}

async function updateMilkSaleImpl(formData: FormData): Promise<FormState> {
  await requireAccess({ module: "OPERATIONS" });
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
      rate: sale.rate ?? undefined,
      amount: sale.amount,
    },
  });

  revalidatePath("/entry/milk-sale");
  revalidatePath("/admin/reports/milk-sales");
  return { success: true, message: "Sale updated." };
}

export async function deleteMilkSale(formData: FormData): Promise<void> {
  await requireAccess({ module: "OPERATIONS" });
  const id = reqId(formData, "id", "Sale");
  // deleteMany: deleting a sale someone else already removed is a no-op, not a crash.
  await prisma.milkSale.deleteMany({ where: { id } });
  revalidatePath("/entry/milk-sale");
  revalidatePath("/admin/reports/milk-sales");
}

