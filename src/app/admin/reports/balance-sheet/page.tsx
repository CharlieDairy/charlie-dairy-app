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
          <Line label="Partner capital in the cash books, not yet in the Capital Ledger" value={formatRs(bs.partnerCapitalNotInLedger)} indent />
          <Line label="Less: asset write-downs not yet charged to profit" value={formatRs(-bs.depreciationNotCharged)} indent />
          <Line label={`Profit since ${bs.explain.booksStart ?? "the books start"} (cash basis)`} value={formatRs(bs.retainedEarnings)} indent />
          <Line label="Total Equity" value={formatRs(bs.totalEquity)} bold />
          <p className="text-xs text-neutral-500 mt-3">Profit comes from the P&amp;L: milk, animal and other income minus running costs. Capital spending and partner money are not in it. Partner money is treated as capital, not a loan.</p>
        </div>
      </div>

      <div className={`rounded-lg p-4 border ${isBalanced ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
        <Line label="Total Assets" value={formatRs(bs.totalAssets)} />
        <Line label="Total Liabilities + Equity" value={formatRs(bs.totalLiabilities + bs.totalEquity)} />
        <Line label="Difference" value={formatRs(bs.difference)} bold />
        {!isBalanced && (
          <p className="text-xs text-amber-700 mt-2">
            The difference is shown, not hidden. What is left after counting partner money as capital and the asset write-downs most likely comes from profit or loss before {bs.explain.booksStart ?? "the books start"}, which are not loaded yet.
            {bs.unclassifiedNet !== 0 ? ` ${formatRs(Math.abs(bs.unclassifiedNet))} of cash entries are still waiting for a class.` : ""}
          </p>
        )}
      </div>

      {!isBalanced && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <h2 className="font-semibold text-neutral-900 mb-2">What is behind the difference</h2>
          <Line label="Fixed assets at cost" value={formatRs(bs.explain.assetCost)} indent />
          <Line label="Written down in the Assets list but never charged to profit" value={formatRs(bs.explain.accumulatedDepreciation)} indent />
          <Line label="Partner money in the cash books since they start (in minus out)" value={formatRs(bs.explain.partnerNetInCashBooks)} indent />
          <Line label="What the Capital Ledger added over the same period" value={formatRs(bs.explain.capitalLedgerSinceStart)} indent />
          <Line label="Partner money not in the Capital Ledger" value={formatRs(bs.explain.partnerNetInCashBooks - bs.explain.capitalLedgerSinceStart)} indent />
          <Line label="Bank-to-petty-cash transfers with no matching receipt" value={formatRs(bs.explain.unmatchedTransfers)} indent />
          <Line label="Cash at the start of the books" value={formatRs(bs.explain.openingCash)} indent />
          <ul className="text-xs text-neutral-600 mt-3 list-disc list-inside flex flex-col gap-1.5">
            <li><b>Depreciation:</b> the Assets list has already written assets down. That amount is now deducted from equity above; it has not been charged month by month to the P&amp;L.</li>
            <li><b>Partner money:</b> confirmed as capital, so what the Capital Ledger does not already hold is counted in equity above. You can also record it by partner in the Capital Ledger.</li>
            <li><b>Before the books start:</b> a negative difference here means the farm has less than its capital and profit say. That is consistent with losses before {bs.explain.booksStart ?? "the first entry"} (including 2023) that are not loaded. The bank book goes back to January 2023. Treat the figure as an estimate until that history is loaded.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
