import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/errors";
import { findStockBreach, type StockTx } from "@/lib/feedStock";

const qty = (n: number) => n.toLocaleString("en-PK", { maximumFractionDigits: 2 });

/**
 * Refuses a feed change that would use stock that was never received. `change` receives the feed's current entries and
 * returns what they would be after the change (add an issue, edit a quantity or date, delete an entry...). Applies to
 * everyone, Admin included: the way out is to record the missing purchase (with its rate) first.
 */
export async function assertStockHolds(feedType: string, change: (before: StockTx[]) => StockTx[], what: "issue" | "removal" = "issue"): Promise<void> {
  const [rows, item] = await Promise.all([
    prisma.feedTransaction.findMany({ where: { feedType }, select: { id: true, date: true, direction: true, quantity: true } }),
    prisma.feedItem.findFirst({ where: { name: feedType }, select: { unit: true } }),
  ]);
  const before: StockTx[] = rows;
  const breach = findStockBreach(before, change(before));
  if (!breach) return;
  const unit = item?.unit ?? "units";
  if (what === "removal") {
    throw new ValidationError(
      `Cannot do that: ${feedType} was already used. It would leave the stock short by ${qty(breach.short)} ${unit} on ${breach.date}. Change or remove the later issues first. Nothing was changed.`
    );
  }
  throw new ValidationError(
    `Not enough ${feedType} in stock on ${breach.date}: only ${qty(breach.available)} ${unit} had been received by then (purchases minus what was already used), and this needs ${qty(breach.short)} ${unit} more. Record the ${feedType} purchase with its rate first, then the issue. Nothing was saved.`
  );
}
