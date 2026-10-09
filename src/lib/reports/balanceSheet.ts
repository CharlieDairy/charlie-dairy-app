import { prisma } from "@/lib/prisma";
import { getMonthlyPnl } from "./pnl";
import { getCustomerSalesSummary } from "./milkSalesByCustomer";
import { classifyCash } from "@/lib/accounting/cashClass";

export type BalanceSheet = {
  asOf: Date;
  cashAndBank: number;
  /** Memo only: customers' unpaid bills. On a cash basis it is NOT part of the assets below. */
  accountsReceivable: number;
  fixedAssets: number;
  totalAssets: number;
  totalLiabilities: number;
  capitalLedger: number;
  /** Partner money in the cash books that is not yet in the Capital Ledger. The owner has confirmed it is capital (not a loan), so it is counted as equity. */
  partnerCapitalNotInLedger: number;
  /** Asset write-downs in the Assets list that were never charged to profit (deducted from equity). */
  depreciationNotCharged: number;
  retainedEarnings: number;
  totalEquity: number;
  difference: number;
  /** Cash entries still waiting for a class (their money is not in the profit). */
  unclassifiedNet: number;
  /** What the records can say about the difference (see the Balance Sheet page). */
  explain: {
    /** First date of the cash books in the app. Profit and cash movements are counted from here. */
    booksStart: string | null;
    /** Cost of the fixed assets, and how much of that has been written down without ever being charged to profit. */
    assetCost: number;
    accumulatedDepreciation: number;
    /** Money the partners put in, net of what they took out, according to the cash books since they start. */
    partnerNetInCashBooks: number;
    /** What the Capital Ledger (Dairy) added over the same period. */
    capitalLedgerSinceStart: number;
    /** Bank-to-petty-cash transfers with no matching receipt on the other side (should be zero). */
    unmatchedTransfers: number;
    /** Cash at the start of the books (petty cash + bank). */
    openingCash: number;
  };
};

// A snapshot assembled from the app's ledgers on a CASH basis -- not an independent
// double-entry system and not an audited statement. Assets are what the farm holds
// in cash and fixed assets; equity is the capital ledger, plus partner money in the cash books
// that the ledger does not hold (capital, confirmed by the owner), less asset write-downs not
// yet charged to profit, plus the cash-basis profit since the cash books start. Customers' unpaid bills are shown as a memo only: on a
// cash basis money owed to the farm is not an asset until it is received. The
// "difference" is shown, not forced to zero, with the figures that explain it.
export async function getBalanceSheet(): Promise<BalanceSheet> {
  const [cashRows, assetsAgg, capitalEntries, customerSales, monthlyPnl] = await Promise.all([
    prisma.cashTransaction.findMany({ select: { date: true, category: true, amountIn: true, amountOut: true, remark: true, accountClass: true } }),
    prisma.asset.aggregate({ _sum: { currentValue: true, value: true } }),
    // Capital Ledger spans multiple ventures on this farm (Dairy, Fattening, loans, construction phases) in one
    // shared ledger -- scoped to venture "Dairy", matching the Capital Ledger page's own filter.
    prisma.capitalEntry.findMany({ where: { venture: "Dairy" }, select: { date: true, credit: true, debit: true } }),
    getCustomerSalesSummary("month"),
    getMonthlyPnl(),
  ]);

  let cashAndBank = 0;
  let unclassifiedNet = 0;
  let partnerNet = 0;
  let transfers = 0;
  let openingCash = 0;
  let start: Date | null = null;
  for (const r of cashRows) {
    const net = r.amountIn - r.amountOut;
    cashAndBank += net;
    if (!start || r.date < start) start = r.date;
    const cls = classifyCash(r);
    if (cls === "REVIEW") unclassifiedNet += net;
    if (cls === "PARTNER_IN" || cls === "PARTNER_OUT") partnerNet += net;
    if (cls === "TRANSFER") transfers += net;
    if (cls === "OPENING") openingCash += net;
  }
  const fixedAssets = assetsAgg._sum.currentValue ?? 0;
  const assetCost = assetsAgg._sum.value ?? 0;
  const accountsReceivable = customerSales.reduce((n, c) => n + Math.max(0, c.outstandingBalance), 0);
  const totalAssets = cashAndBank + fixedAssets;

  // [1] No Vendor Bill / Accounts Payable model exists: on a cash basis only paid costs are recorded.
  const totalLiabilities = 0;

  const capitalLedger = capitalEntries.reduce((n, e) => n + e.credit - e.debit, 0);
  const capitalLedgerSinceStart = start ? capitalEntries.filter((e) => e.date >= start!).reduce((n, e) => n + e.credit - e.debit, 0) : 0;
  const retainedEarnings = monthlyPnl.reduce((n, m) => n + m.net, 0);
  // The owner has confirmed that partner money is capital, not a loan. What the Capital Ledger does not already hold is added here.
  const partnerCapitalNotInLedger = partnerNet - capitalLedgerSinceStart;
  const depreciationNotCharged = assetCost - fixedAssets;
  const totalEquity = capitalLedger + partnerCapitalNotInLedger - depreciationNotCharged + retainedEarnings;
  const difference = totalAssets - (totalLiabilities + totalEquity);

  return {
    asOf: new Date(),
    cashAndBank,
    accountsReceivable,
    fixedAssets,
    totalAssets,
    totalLiabilities,
    capitalLedger,
    partnerCapitalNotInLedger,
    depreciationNotCharged,
    retainedEarnings,
    totalEquity,
    difference,
    unclassifiedNet,
    explain: {
      booksStart: start ? start.toISOString().slice(0, 10) : null,
      assetCost,
      accumulatedDepreciation: assetCost - fixedAssets,
      partnerNetInCashBooks: partnerNet,
      capitalLedgerSinceStart,
      unmatchedTransfers: transfers,
      openingCash,
    },
  };
}
