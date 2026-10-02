import Link from "next/link";
import { formatRs } from "@/lib/format";
import { getBalanceSheet } from "@/lib/reports/balanceSheet";

function Line({ label, value, bold, indent }: { label: string; value: string; bold?: boolean; indent?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 ${bold ? "font-semibold border-t border-neutral-200 mt-1 pt-2" : ""} ${indent ? "pl-4 text-neutral-600" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default async function BalanceSheetPage() {
  const bs = await getBalanceSheet();
  const asOf = bs.asOf.toISOString().slice(0, 10);
  const isBalanced = Math.abs(bs.difference) < 1;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Balance Sheet</h1>
        <p className="text-sm text-neutral-500">As of {asOf}</p>
      </div>

      <p className="text-base font-semibold text-neutral-600">
        Assembled from Cash Entry, Milk Sales, Assets and the Capital Ledger — not an independent double-entry
        system, so treat this as a working snapshot rather than an audited statement. Equity below is scoped to the{" "}
        <Link href="/admin/capital?venture=Dairy" className="link-btn">
          Dairy venture
        </Link>{" "}
        only — the Capital Ledger also tracks Fattening, loan tranches and construction phases that aren&apos;t part
        of this app.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <h2 className="font-semibold text-neutral-900 mb-2">Assets</h2>
        <Line label="Cash & Bank" value={formatRs(bs.cashAndBank)} indent />
        <Line label="Accounts Receivable (Customers)" value={formatRs(bs.accountsReceivable)} indent />
        <Line label="Fixed Assets" value={formatRs(bs.fixedAssets)} indent />
        <Line label="Total Assets" value={formatRs(bs.totalAssets)} bold />
        <ul className="text-xs text-neutral-500 mt-3 list-disc list-inside flex flex-col gap-1">
          <li>Cash &amp; Bank: every Cash Entry in minus out, all time.</li>
          <li>
            Accounts Receivable: Milk Sales not yet paid (sales minus recorded customer payments), less lump-sum milk
            cash receipts booked since itemized sales began, so the same money isn&apos;t counted as both cash and a receivable.
          </li>
          <li>Fixed Assets: the sum of each line&apos;s Current Value on the Assets page (already the line total, not per unit).</li>
        </ul>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <h2 className="font-semibold text-neutral-900 mb-2">Liabilities</h2>
        <Line label="Accounts Payable (Vendors)" value="Not tracked" indent />
        <Line label="Total Liabilities" value={formatRs(bs.totalLiabilities)} bold />
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <h2 className="font-semibold text-neutral-900 mb-2">Equity</h2>
        <Line label="Capital Ledger — Dairy venture only" value={formatRs(bs.capitalLedger)} indent />
        <Line label="Retained Earnings (cumulative net income)" value={formatRs(bs.retainedEarnings)} indent />
        <Line label="Total Equity" value={formatRs(bs.totalEquity)} bold />
      </div>
      </div>

      <div className={`rounded-lg p-4 border ${isBalanced ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
        <Line label="Total Assets" value={formatRs(bs.totalAssets)} />
        <Line label="Total Liabilities + Equity" value={formatRs(bs.totalLiabilities + bs.totalEquity)} />
        <Line label="Difference" value={formatRs(bs.difference)} bold />
        {!isBalanced && (
          <p className="text-xs text-amber-700 mt-2">
            Doesn&apos;t balance to zero — likely because some cash-in rows (e.g. capital brought in as cash, or
            historical entries before the Capital Ledger existed) are counted as revenue in the P&amp;L rather than
            as a capital contribution. Worth a look at the Expense Breakdown / Cash Entry categories if this gap
            is large.
          </p>
        )}
      </div>
    </div>
  );
}
