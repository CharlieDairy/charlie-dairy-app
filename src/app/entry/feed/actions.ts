"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess, runAction } from "@/lib/access";
import { ValidationError } from "@/lib/errors";
import { reqDate, reqEnum, reqNum, reqText, optNum, DIRECTIONS } from "@/lib/validate";
import { revalidatePath } from "next/cache";

export type FormState = { success: boolean; message: string } | undefined;

export async function submitFeed(_prev: FormState, formData: FormData): Promise<FormState> {
  return runAction(() => submitFeedImpl(formData));
}

async function submitFeedImpl(formData: FormData): Promise<FormState> {
  await requireAccess({ module: "OPERATIONS" });

  const date = reqDate(formData, "date", "Date");
  const feedType = reqText(formData, "feedType", "Feed type", { max: 100 });
  const direction = reqEnum(formData, "direction", "Direction", DIRECTIONS); // "IN" | "OUT"
  const quantity = reqNum(formData, "quantity", "Quantity", { positive: true, max: 10_000_000 });
  const rate = optNum(formData, "rate", "Rate", { max: 1_000_000 });

  const duplicate = await prisma.feedTransaction.findFirst({
    where: { date, feedType, direction, quantity, createdAt: { gte: new Date(Date.now() - 120_000) } },
    select: { id: true },
  });
  if (duplicate) {
    throw new ValidationError("This looks identical to an entry saved moments ago, so it wasn't saved twice.");
  }

  // Recorded stock for this feed type before this entry, to warn (not block --
  // older stock may simply never have been entered) when an OUT overdraws it.
  let stockAfter: number | null = null;
  if (direction === "OUT") {
    const [inAgg, outAgg] = await Promise.all([
      prisma.feedTransaction.aggregate({ _sum: { quantity: true }, where: { feedType, direction: "IN" } }),
      prisma.feedTransaction.aggregate({ _sum: { quantity: true }, where: { feedType, direction: "OUT" } }),
    ]);
    stockAfter = (inAgg._sum.quantity ?? 0) - (outAgg._sum.quantity ?? 0) - quantity;
  }

  await prisma.feedTransaction.create({
    data: {
      date,
      feedType,
      direction,
      quantity,
      rate: rate ?? undefined,
      cost: rate && direction === "OUT" ? Math.round(rate * quantity * 100) / 100 : undefined,
    },
  });

  revalidatePath("/entry/feed");
  revalidatePath("/admin/reports/feed");
  const warning =
    stockAfter !== null && stockAfter < 0
      ? ` Warning: recorded stock of ${feedType} is now ${stockAfter.toFixed(1)} — a purchase may be missing.`
      : "";
  return { success: true, message: `Feed entry saved.${warning}` };
}
