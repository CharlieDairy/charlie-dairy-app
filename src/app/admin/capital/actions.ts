"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAccess, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqEnum, reqNum, reqText, optText } from "@/lib/validate";

export type FormState = { success: boolean; message: string } | undefined;

const DIRECTIONS = ["CONTRIBUTION", "WITHDRAWAL"] as const;

export async function addCapitalEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => addCapitalEntryImpl(formData));
}

async function addCapitalEntryImpl(formData: FormData): Promise<FormState> {
  await requireAccess({ module: "FINANCIAL" });

  const date = reqDate(formData, "date", "Date");
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
