import { prisma } from "@/lib/prisma";
import { getBalanceSheet } from "@/lib/reports/balanceSheet";
import { MILK_CASH_CATEGORY, getMilkSalesCutover } from "@/lib/reports/pnl";
import { classifyCash } from "@/lib/accounting/cashClass";
import { type Rule, addDays, key, rs } from "../types";

// Everything here is finance-only: only the Admin sees these findings.
export const accountingRules: Rule[] = [
  {
    id: "acct.review-class",
    async run() {
      const rows = await prisma.cashTransaction.findMany({
        select: { date: true, category: true, amountIn: true, amountOut: true, remark: true, accountClass: true },
      });
      const review = rows.filter((r) => classifyCash(r) === "REVIEW");
      if (review.length === 0) return [];
      const money = review.reduce((n, r) => n + r.amountIn + r.amountOut, 0);
      return [
        {
          key: "acct.review-class",
          ruleId: "acct.review-class",
          category: "ACCOUNTING",
          severity: "LOW",
          financeOnly: true,
          title: `${review.length} cash entr${review.length === 1 ? "y is" : "ies are"} not counted in profit yet (class needed)`,
          detail: review.slice(0, 5).map((r) => `${key(r.date)} ${r.category}: ${rs(r.amountIn || r.amountOut)}${r.remark ? ` - ${r.remark.replace(/\s+/g, " ").slice(0, 50)}` : ""}`).join("; ") + `. About ${rs(money)} in total.`,
          suggestion: "Open the Cash Register, edit the entry and choose what it was (milk sale, cost, capital spending, money from or to a partner). Admin only.",
          metric: { count: review.length, amount: Math.round(money) },
        },
      ];
    },
  },
  {
    id: "acct.unlinked-receipts",
    async run() {
      const cutover = await getMilkSalesCutover();
      if (!cutover) return [];
      const receipts = await prisma.cashTransaction.findMany({
        where: { category: MILK_CASH_CATEGORY, date: { gte: cutover }, amountIn: { gt: 0 }, customerPayment: null },
        select: { date: true, amountIn: true },
      });
      if (receipts.length === 0) return [];
      const total = receipts.reduce((n, r) => n + r.amountIn, 0);
      return [
        {
          key: "acct.unlinked-receipts",
          ruleId: "acct.unlinked-receipts",
          category: "ACCOUNTING",
          severity: total > 100_000 ? "HIGH" : "MEDIUM",
          financeOnly: true,
          title: `${receipts.length} milk receipt${receipts.length === 1 ? "" : "s"} (${rs(total)}) not linked to a customer`,
          detail: `Since ${key(cutover)} these receipts are in the Cash Register but not tied to a customer, so that customer's balance still shows the bill as unpaid.`,
          suggestion: "Cash Entry now asks which customer a milk receipt is from. For these older ones, the Admin can edit the entry or re-enter it with the customer.",
          metric: { count: receipts.length, amount: Math.round(total) },
        },
      ];
    },
  },
  {
    id: "acct.sales-vs-receipts",
    async run({ today }) {
      const from = addDays(today, -365);
      const [billed, received] = await Promise.all([
        prisma.milkSale.aggregate({ where: { date: { gte: from, lt: today } }, _sum: { amount: true } }),
        prisma.cashTransaction.findMany({ where: { date: { gte: from, lt: today }, amountIn: { gt: 0 } }, select: { category: true, amountIn: true, amountOut: true, remark: true, accountClass: true } }),
      ]);
      const sold = billed._sum.amount ?? 0;
      const cash = received.filter((r) => classifyCash(r) === "MILK_SALES").reduce((n, r) => n + r.amountIn, 0);
      if (sold < 500_000) return [];
      const ratio = cash / sold;
      if (ratio >= 0.9) return [];
      return [
        {
          key: "acct.sales-vs-receipts",
          ruleId: "acct.sales-vs-receipts",
          category: "ACCOUNTING",
          severity: "MEDIUM",
          financeOnly: true,
          title: `Milk sold in the last 12 months is ${rs(sold)} but only ${rs(cash)} of milk receipts is in the Cash Register`,
          detail: `${Math.round(ratio * 100)}% of what was sold has arrived as recorded cash. The rest may have been paid into a bank account that is not in the Cash Register (for example Engro, paid by bank), or may still be owed.`,
          suggestion: "Add the bank account's CashBook (Meezan Bank Account) so bank receipts are counted, then re-check.",
          metric: { sold: Math.round(sold), receivedInCashRegister: Math.round(cash), pct: Math.round(ratio * 100) },
        },
      ];
    },
  },
  {
    id: "acct.balance-sheet",
    async run() {
      const bs = await getBalanceSheet();
      const abs = Math.abs(bs.difference);
      const limit = Math.max(50_000, Math.abs(bs.totalAssets) * 0.01);
      if (abs <= limit) return [];
      return [
        {
          key: "acct.balance-sheet",
          ruleId: "acct.balance-sheet",
          category: "ACCOUNTING",
          severity: abs > Math.abs(bs.totalAssets) * 0.1 ? "HIGH" : "MEDIUM",
          financeOnly: true,
          title: `The Balance Sheet does not balance (difference ${rs(bs.difference)})`,
          detail: `Assets ${rs(bs.totalAssets)} (cash ${rs(bs.cashAndBank)}, fixed assets ${rs(bs.fixedAssets)}) against equity ${rs(bs.totalEquity)} and no liabilities. Equity is the Capital Ledger ${rs(bs.capitalLedger)}, plus partner money not in that ledger ${rs(bs.partnerCapitalNotInLedger)} (the owner confirmed it is capital, not a loan), less ${rs(bs.depreciationNotCharged)} of asset write-downs, plus profit since ${bs.explain.booksStart ?? "the books start"} ${rs(bs.retainedEarnings)}. ${bs.difference < 0 ? "Equity is higher than the assets" : "Assets are higher than equity"} by ${rs(abs)}. The likely cause is profit or loss before the books start (the bank book goes back to January 2023), plus the unmatched bank-to-petty transfers.`,
          suggestion: "Load the earlier history (2023 to February 2024) and match the unmatched transfers. Then re-check; whatever is left is a real error or a missing asset or liability.",
          metric: { difference: Math.round(bs.difference), totalAssets: Math.round(bs.totalAssets), totalEquity: Math.round(bs.totalEquity), depreciation: Math.round(bs.explain.accumulatedDepreciation), partnerCapitalNotInLedger: Math.round(bs.partnerCapitalNotInLedger) },
        },
      ];
    },
  },
  {
    id: "acct.transfer-imbalance",
    async run() {
      const bs = await getBalanceSheet();
      const t = bs.explain.unmatchedTransfers;
      if (Math.abs(t) < 1000) return [];
      return [
        {
          key: "acct.transfer-imbalance",
          ruleId: "acct.transfer-imbalance",
          category: "ACCOUNTING",
          severity: "LOW",
          financeOnly: true,
          title: `${rs(Math.abs(t))} moved between the bank and petty cash without a matching entry on the other side`,
          detail: `Transfers between the farm's own books should cancel out. ${t < 0 ? "More left the bank than arrived in petty cash" : "More arrived in petty cash than left the bank"} by ${rs(Math.abs(t))} (mainly bank transfers in March 2024 and January 2025). Either a petty-cash receipt was entered under a different amount, or part of the transfer was never recorded.`,
          suggestion: "Compare the bank transfers to the farm manager (Meezan book) with the matching petty-cash receipts and correct the amounts or the missing entry.",
          metric: { imbalance: Math.round(t) },
        },
      ];
    },
  },
];
