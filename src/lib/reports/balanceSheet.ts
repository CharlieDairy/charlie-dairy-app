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
  retainedEarnings: number;
  /** Net money put in by (or taken out by) the partners through the Cash Register since the records began. */
  partnerCashNet: number;
  totalEquity: number;
  difference: number;
  /** Cash entries still waiting for a class (their money is not in the profit). */
  unclassifiedNet: number;
};

// A snapshot assembled from the app's ledgers on a CASH basis -- not an independent
// double-entry system and not an audited statement. Assets are what the farm holds
// in cash and fixed assets; equity is the capital ledger plus the cash-basis profit
// since the records began. Customers' unpaid bills are shown as a memo only: on a
// cash basis money owed to the farm is not an asset until it is received. The
// "difference" is shown, not forced to zero: it reflects what the app cannot yet
// know (opening balances before 2025, money owed to suppliers, depreciation).
export async function getBalanceSheet(): Promise<BalanceSheet> {
  const [cashRows, assetsAgg, capitalEntries, customerSales, monthlyPnl] = await Promise.all([
    prisma.cashTransaction.findMany({ select: { category: true, amountIn: true, amountOut: true, remark: true, accountClass: true } }),
    prisma.asset.aggregate({ _sum: { currentValue: true } }),
    // Capital Ledger spans multiple ventures on this farm (Dairy, Fattening, loans, construction phases) in one
    // shared ledger -- scoped to venture "Dairy", matching the Capital Ledger page's own filter.
    prisma.capitalEntry.findMany({ where: { venture: "Dairy" }, select: { credit: true, debit: true } }),
    getCustomerSalesSummary("month"),
    getMonthlyPnl(),
  ]);

  let cashAndBank = 0;
  let partnerCashNet = 0;
  let unclassifiedNet = 0;
  for (const r of cashRows) {
    cashAndBank += r.amountIn - r.amountOut;
    const cls = classifyCash(r);
    if (cls === "PARTNER_IN" || cls === "PARTNER_OUT") partnerCashNet += r.amountIn - r.amountOut;
    if (cls === "REVIEW") unclassifiedNet += r.amountIn - r.amountOut;
  }
  const fixedAssets = assetsAgg._sum.currentValue ?? 0;
  const accountsReceivable = customerSales.reduce((n, c) => n + Math.max(0, c.outstandingBalance), 0);
  const totalAssets = cashAndBank + fixedAssets;

  // [1] No Vendor Bill / Accounts Payable model exists: on a cash basis only paid costs are recorded.
  const totalLiabilities = 0;

  const capitalLedger = capitalEntries.reduce((n, e) => n + e.credit - e.debit, 0);
  const retainedEarnings = monthlyPnl.reduce((n, m) => n + m.net, 0);
  const totalEquity = capitalLedger + retainedEarnings;
  const difference = totalAssets - (totalLiabilities + totalEquity);

  return {
    asOf: new Date(),
    cashAndBank,
    accountsReceivable,
    fixedAssets,
    totalAssets,
    totalLiabilities,
    capitalLedger,
    retainedEarnings,
    partnerCashNet,
    totalEquity,
    difference,
    unclassifiedNet,
  };
}
