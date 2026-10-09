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
        <p className="text-sm text-neutral-500">As of {asOf} · cash basis</p>
      </div>

      <p className="text-base font-semibold text-neutral-600">
        A working snapshot built from the Cash Register, the Assets list and the Capital Ledger. It is not an audited statement. On a cash basis, money
        customers still owe is not counted as an asset until it is received (it is shown below as a note). Equity is scoped to the{" "}
        <Link href="/admin/capital?venture=Dairy" className="link-btn">Dairy venture</Link>{" "}
        only.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <h2 className="font-semibold text-neutral-900 mb-2">Assets</h2>
          <Line label="Cash & Bank" value={formatRs(bs.cashAndBank)} indent />
          <Line label="Fixed Assets" value={formatRs(bs.fixedAssets)} indent />
          <Line label="Total Assets" value={formatRs(bs.totalAssets)} bold />
          <ul className="text-xs text-neutral-500 mt-3 list-disc list-inside flex flex-col gap-1">
            <li>Cash &amp; Bank: petty cash plus the Meezan bank account, from the opening balances on {bs.explain.booksStart ?? "the first entry"}. It equals the CashBook balances.</li>
            <li>Fixed Assets: the Current Value of each line on the Assets page.</li>
            <li>Note: customers currently owe {formatRs(bs.accountsReceivable)} (not counted above, cash basis).</li>
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
          <Line label={`Profit since ${bs.explain.booksStart ?? "the books start"} (cash basis)`} value={formatRs(bs.retainedEarnings)} indent />
          <Line label="Total Equity" value={formatRs(bs.totalEquity)} bold />
          <p className="text-xs text-neutral-500 mt-3">Profit comes from the P&amp;L: milk, animal and other income minus running costs. Capital spending and partner money are not in it.</p>
        </div>
      </div>

      <div className={`rounded-lg p-4 border ${isBalanced ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
        <Line label="Total Assets" value={formatRs(bs.totalAssets)} />
        <Line label="Total Liabilities + Equity" value={formatRs(bs.totalLiabilities + bs.totalEquity)} />
        <Line label="Difference" value={formatRs(bs.difference)} bold />
        {!isBalanced && (
          <p className="text-xs text-amber-700 mt-2">
            The difference is shown, not hidden. The facts below explain most of it; closing it needs the decisions listed there.
            {bs.unclassifiedNet !== 0 ? ` ${formatRs(Math.abs(bs.unclassifiedNet))} of cash entries are still waiting for a class.` : ""}
          </p>
        )}
      </div>

      {!isBalanced && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <h2 className="font-semibold text-neutral-900 mb-2">What explains the difference</h2>
          <Line label="Fixed assets at cost" value={formatRs(bs.explain.assetCost)} indent />
          <Line label="Written down in the Assets list but never charged to profit" value={formatRs(bs.explain.accumulatedDepreciation)} indent />
          <Line label="Partner money in the cash books since they start (in minus out)" value={formatRs(bs.explain.partnerNetInCashBooks)} indent />
          <Line label="What the Capital Ledger added over the same period" value={formatRs(bs.explain.capitalLedgerSinceStart)} indent />
          <Line label="Partner money not in the Capital Ledger" value={formatRs(bs.explain.partnerNetInCashBooks - bs.explain.capitalLedgerSinceStart)} indent />
          <Line label="Bank-to-petty-cash transfers with no matching receipt" value={formatRs(bs.explain.unmatchedTransfers)} indent />
          <Line label="Cash at the start of the books" value={formatRs(bs.explain.openingCash)} indent />
          <ul className="text-xs text-neutral-600 mt-3 list-disc list-inside flex flex-col gap-1.5">
            <li><b>Depreciation:</b> the Assets list has already written assets down, but that cost has not been charged to profit, so equity is too high by that amount.</li>
            <li><b>Partner money:</b> the cash books show partners putting in much more than the Capital Ledger records. Each such amount is either capital (add it to the Capital Ledger) or a loan from a partner (a liability, which the app does not track yet). The owner decides which.</li>
            <li><b>Before the books start:</b> profit or loss earlier than {bs.explain.booksStart ?? "the first entry"} (including 2023) is not in the profit above. The bank book goes back to January 2023.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
