import { prisma } from "@/lib/prisma";
import { getMonthlyPnl } from "./pnl";
import { getCustomerSalesSummary } from "./milkSalesByCustomer";

export type BalanceSheet = {
  asOf: Date;
  cashAndBank: number;
  accountsReceivable: number;
  fixedAssets: number;
  totalAssets: number;
  totalLiabilities: number;
  capitalLedger: number;
  retainedEarnings: number;
  totalEquity: number;
  difference: number;
};

// A snapshot assembled from the app's existing ledgers, not an independent
// double-entry system -- there's no chart of accounts here, so this can't
// be a "real" audited Balance Sheet. It's built to tie out with what the
// other Financial reports already show (same Cash Flow / P&L net, same
// Capital Ledger, same Asset values), and the "difference" line is shown
// rather than hidden/forced to zero, since Liabilities aren't tracked at
// all yet (see [1]) -- an honest gap is more useful than a fake balance.
export async function getBalanceSheet(): Promise<BalanceSheet> {
  const [cashAgg, assetsAgg, capitalEntries, customerSales, monthlyPnl] = await Promise.all([
    prisma.cashTransaction.aggregate({ _sum: { amountIn: true, amountOut: true } }),
    prisma.asset.aggregate({ _sum: { currentValue: true } }),
    // Capital Ledger spans multiple ventures on this farm (Dairy, Fattening,
    // several loan tranches, construction phases) tracked in one shared
    // ledger by partner -- summing all of it would pull in equity/debt for
    // businesses this app has nothing to do with. Scoped to venture "Dairy"
    // only, matching the Capital Ledger page's own "Charlie Dairy-specific
    // entries" filter.
    prisma.capitalEntry.findMany({ where: { venture: "Dairy" }, select: { credit: true, debit: true } }),
    getCustomerSalesSummary("all"),
    getMonthlyPnl(),
  ]);

  const cashAndBank = (cashAgg._sum.amountIn ?? 0) - (cashAgg._sum.amountOut ?? 0);
  const fixedAssets = assetsAgg._sum.currentValue ?? 0;
  // Only unpaid balances count as a receivable asset -- a customer who has
  // overpaid (negative outstanding) isn't a liability we track here.
  const accountsReceivable = customerSales.reduce((n, c) => n + Math.max(0, c.outstandingBalance), 0);
  const totalAssets = cashAndBank + accountsReceivable + fixedAssets;

  // [1] No Vendor Bill / Accounts Payable model exists -- vendor spend is
  // cash-basis (paid when entered), so there's nothing owed to track here.
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
    totalEquity,
    difference,
  };
}
