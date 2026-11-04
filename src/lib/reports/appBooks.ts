import { prisma } from "@/lib/prisma";
import { isFeedCategory, type CashClassKey } from "@/lib/accounting/cashClass";

// From the day the app began itemising milk sales, the P&L and the dashboard take two things straight from the app's own
// records, so they flow the day they are entered instead of waiting for the Cash Register:
//   * milk sales = what was billed (MilkSale), not what has been collected
//   * feed cost  = feed used from stock at its FIFO cost (FeedTransaction OUT), not feed purchases
// To keep every rupee counted once, the cash entries that the app now counts are left out from that day on: the customer
// payments (a collection of money already billed) and feed purchases (the stock is costed when it is used).
// Everything else (salaries, fuel, medical, A.I., animal sales ...) is still read from the Cash Register.
// Before that day nothing changes: the history stays exactly as the cash book recorded it.

export const APP_MILK_CATEGORY = "Milk sales (billed in the app)";
export const APP_FEED_CATEGORY = "Opex Feed (used from stock)";

export type AppBooks = {
  /** first day an itemised (non-backfill) milk sale exists; null when there is none yet */
  cutover: Date | null;
  /** cash entries created by a customer payment */
  paymentCashIds: Set<string>;
  milk: { date: Date; amount: number }[];
  feedUsed: { date: Date; cost: number }[];
};

export const NO_APP_BOOKS: AppBooks = { cutover: null, paymentCashIds: new Set(), milk: [], feedUsed: [] };

export async function loadAppBooks(): Promise<AppBooks> {
  const first = await prisma.milkSale.findFirst({
    where: { OR: [{ enteredBy: null }, { enteredBy: { not: "Backfill (cash ledger)" } }] },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  if (!first) return NO_APP_BOOKS;
  const cutover = first.date;
  const [sales, feed, payments] = await Promise.all([
    prisma.milkSale.findMany({ where: { date: { gte: cutover } }, select: { date: true, amount: true } }),
    prisma.feedTransaction.findMany({ where: { direction: "OUT", date: { gte: cutover } }, select: { date: true, cost: true } }),
    prisma.customerPayment.findMany({ where: { cashTransactionId: { not: null } }, select: { cashTransactionId: true } }),
  ]);
  return {
    cutover,
    paymentCashIds: new Set(payments.flatMap((p) => (p.cashTransactionId ? [p.cashTransactionId] : []))),
    milk: sales,
    feedUsed: feed.flatMap((f) => (f.cost ? [{ date: f.date, cost: f.cost }] : [])),
  };
}

/** True when the app's own records already count this cash entry, so the Cash Register copy must not be added again. */
export function coveredByApp(books: Pick<AppBooks, "cutover" | "paymentCashIds">, row: { id: string; date: Date; category: string | null }, cls: CashClassKey): boolean {
  if (!books.cutover || row.date < books.cutover) return false;
  if (cls === "MILK_SALES" && books.paymentCashIds.has(row.id)) return true;
  if (cls === "OPEX" && isFeedCategory(row.category)) return true;
  return false;
}
