import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import { formatRs } from "@/lib/format";
import { getCustomerSalesSummary, getCustomerDetail, getDistinctBuyers } from "@/lib/reports/milkSalesByCustomer";
import CustomerSalesTable from "./CustomerSalesTable";
import RecordPaymentForm from "./RecordPaymentForm";

function fmtDate(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

export default async function MilkSalesByCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ buyer?: string }>;
}) {
  const params = await searchParams;
  const [summary, buyers] = await Promise.all([getCustomerSalesSummary(), getDistinctBuyers()]);
  const detail = params.buyer ? await getCustomerDetail(params.buyer) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Milk Sales by Customer" />
      <p className="text-sm text-neutral-500 max-w-2xl">
        Every customer&apos;s sales, rate, and running balance. Recording a payment here also creates a real entry in
        the Cash ledger — it shows up in Cash Flow and P&amp;L immediately, not as a separate untracked number.
      </p>

      <CustomerSalesTable rows={summary} />

      <Card>
        <h2 className="font-semibold text-text mb-2">Record a Payment</h2>
        <RecordPaymentForm buyers={buyers} defaultBuyer={params.buyer} />
      </Card>

      {detail && params.buyer && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-text">{params.buyer} — Detail</h2>
            <Link href="/admin/reports/milk-sales" className="text-sm text-neutral-500 underline">
              Clear selection
            </Link>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase mb-2">Sales ({detail.sales.length})</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-neutral-500">
                    <th className="text-left py-1 font-normal">Date</th>
                    <th className="text-right py-1 font-normal">Litres</th>
                    <th className="text-right py-1 font-normal">Rate</th>
                    <th className="text-right py-1 font-normal">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.sales.map((s) => (
                    <tr key={s.id} className="border-t border-neutral-100">
                      <td className="py-1">{fmtDate(s.date)}</td>
                      <td className="py-1 text-right">{s.litres}</td>
                      <td className="py-1 text-right">{s.rate !== null ? `Rs ${s.rate.toFixed(2)}` : "—"}</td>
                      <td className="py-1 text-right">{formatRs(s.amount)}</td>
                    </tr>
                  ))}
                  {detail.sales.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 text-center text-neutral-400">No sales recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase mb-2">Payments ({detail.payments.length})</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-neutral-500">
                    <th className="text-left py-1 font-normal">Date</th>
                    <th className="text-left py-1 font-normal">Mode</th>
                    <th className="text-right py-1 font-normal">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.payments.map((p) => (
                    <tr key={p.id} className="border-t border-neutral-100">
                      <td className="py-1">{fmtDate(p.date)}</td>
                      <td className="py-1">{p.mode}</td>
                      <td className="py-1 text-right">{formatRs(p.amount)}</td>
                    </tr>
                  ))}
                  {detail.payments.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-3 text-center text-neutral-400">No payments recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
