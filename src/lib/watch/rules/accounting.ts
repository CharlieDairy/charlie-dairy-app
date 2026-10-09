import { prisma } from "@/lib/prisma";
import { getBalanceSheet } from "@/lib/reports/balanceSheet";
import { MILK_CASH_CATEGORY, getMilkSalesCutover, getMonthlyPnl } from "@/lib/reports/pnl";
import { type Rule, key, rs } from "../types";

// Everything here is finance-only: only the Admin sees these findings.
export const accountingRules: Rule[] = [
  {
    id: "acct.revenue-definition",
    async run({ today }) {
      const [pnl, sales] = await Promise.all([
        getMonthlyPnl(),
        prisma.$queryRaw<{ m: string; a: number }[]>`SELECT to_char(date, 'YYYY-MM') AS m, SUM(amount)::float AS a FROM "MilkSale" GROUP BY 1`,
      ]);
      const sold = new Map(sales.map((s) => [s.m, s.a]));
      const last12 = pnl.filter((m) => m.month >= key(new Date(today.getTime() - 365 * 86_400_000)).slice(0, 7) && m.month < key(today).slice(0, 7));
      const off = last12
        .map((m) => ({ month: m.month, revenue: m.revenue, sales: sold.get(m.month) ?? 0 }))
        .filter((m) => m.sales > 0 && m.revenue > m.sales * 1.5);
      if (off.length === 0) return [];
      const over = off.reduce((n, m) => n + (m.revenue - m.sales), 0);
      const worst = [...off].sort((a, b) => b.revenue - b.sales - (a.revenue - a.sales))[0];
      return [
        {
          key: "acct.revenue-definition",
          ruleId: "acct.revenue-definition",
          category: "ACCOUNTING",
          severity: "HIGH",
          financeOnly: true,
          title: "The P&L counts every rupee received as 'revenue'",
          detail: `In ${off.length} of the last 12 months, P&L revenue is more than 1.5 times the milk actually sold. Example: ${worst.month} shows ${rs(worst.revenue)} revenue against ${rs(worst.sales)} of milk sales. In total about ${rs(over)} of receipts (partner capital, loans and other money in) are being treated as profit-making income, so profit is overstated.`,
          suggestion: "Split cash receipts into: milk sales, other income, partner capital, loans. Only sales and other income belong in revenue. This is the first fix before month-end close can be trusted.",
          metric: { monthsAffected: off.length, overstated: Math.round(over), worstMonth: worst.month },
        },
      ];
    },
  },
  {
    id: "acct.unlinked-receipts",
    async run() {
      const cutover = await getMilkSalesCutover();
      if (!cutover) return [];
      const [receipts, payments, billed] = await Promise.all([
        prisma.cashTransaction.aggregate({ where: { category: MILK_CASH_CATEGORY, date: { gte: cutover } }, _sum: { amountIn: true } }),
        prisma.customerPayment.aggregate({ _sum: { amount: true } }),
        prisma.milkSale.aggregate({ where: { OR: [{ enteredBy: null }, { enteredBy: { not: "Backfill (cash ledger)" } }] }, _sum: { amount: true } }),
      ]);
      const rec = receipts._sum.amountIn ?? 0;
      const paid = payments._sum.amount ?? 0;
      if (rec <= 0 || paid >= rec * 0.5) return [];
      return [
        {
          key: "acct.unlinked-receipts",
          ruleId: "acct.unlinked-receipts",
          category: "ACCOUNTING",
          severity: "HIGH",
          financeOnly: true,
          title: "Customer payments are recorded as plain cash receipts, so every customer looks unpaid",
          detail: `Since ${key(cutover)} the cash book has ${rs(rec)} of 'milk sale' receipts, but only ${rs(paid)} is recorded as customer payments. Sales billed in the same period are ${rs(billed._sum.amount ?? 0)}, so customer balances (and the Balance Sheet receivable) are overstated by roughly ${rs(Math.max(0, rec - paid))}.`,
          suggestion: "Record each receipt with Record Payment on Milk Sales (which also writes the cash entry). For money already entered as a cash receipt, the Admin can convert or re-enter it against the customer.",
          metric: { receipts: Math.round(rec), customerPayments: Math.round(paid), billed: Math.round(billed._sum.amount ?? 0) },
        },
      ];
    },
  },
  {
    id: "acct.balance-sheet",
    async run() {
      const bs = await getBalanceSheet();
      const limit = Math.max(50_000, Math.abs(bs.totalAssets) * 0.01);
      if (Math.abs(bs.difference) <= limit) return [];
      return [
        {
          key: "acct.balance-sheet",
          ruleId: "acct.balance-sheet",
          category: "ACCOUNTING",
          severity: "HIGH",
          financeOnly: true,
          title: `The Balance Sheet does not balance (difference ${rs(bs.difference)})`,
          detail: `Assets ${rs(bs.totalAssets)} (cash ${rs(bs.cashAndBank)}, receivables ${rs(bs.accountsReceivable)}, fixed assets ${rs(bs.fixedAssets)}) against equity ${rs(bs.totalEquity)} and liabilities ${rs(bs.totalLiabilities)}. Liabilities are not tracked, and the revenue and receivable issues above feed into this gap.`,
          suggestion: "Fix the revenue split and customer-payment linking first, then re-check. Remaining difference will point to missing liabilities, depreciation or opening balances.",
          metric: { difference: Math.round(bs.difference), totalAssets: Math.round(bs.totalAssets), totalEquity: Math.round(bs.totalEquity) },
        },
      ];
    },
  },
];
