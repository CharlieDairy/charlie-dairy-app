"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqEnum, reqNum, reqText, optText, DIRECTIONS } from "@/lib/validate";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

export async function submitCash(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => submitCashImpl(formData));
}

async function submitCashImpl(formData: FormData): Promise<FormState> {
  const user = await requireAccess({ module: "FINANCIAL" });

  const date = reqDate(formData, "date", "Date");
  const direction = reqEnum(formData, "direction", "Direction", DIRECTIONS); // "IN" | "OUT"
  const amount = reqNum(formData, "amount", "Amount", { positive: true });
  const category = reqText(formData, "category", "Category", { max: 100 });
  const remark = optText(formData, "remark", "Remark", { max: 500 });
  const party = optText(formData, "party", "Party", { max: 100 });

  const amountIn = direction === "IN" ? amount : 0;
  const amountOut = direction === "OUT" ? amount : 0;

  // Double-tap / double-submit guard.
  const duplicate = await prisma.cashTransaction.findFirst({
    where: { date, category, party, amountIn, amountOut, createdAt: { gte: new Date(Date.now() - 120_000) } },
    select: { id: true },
  });
  if (duplicate) {
    throw new ValidationError("This looks identical to an entry saved moments ago, so it wasn't saved twice.");
  }

  await prisma.cashTransaction.create({
    data: { date, category, party, remark, mode: "CASH", amountIn, amountOut, enteredBy: user.name },
  });

  revalidatePath("/entry/cash");
  return { success: true, message: "Cash entry saved." };
}
