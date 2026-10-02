import Link from "next/link";
import { notFound } from "next/navigation";
import { formatRs } from "@/lib/format";
import { getCustomerDetail } from "@/lib/reports/milkSalesByCustomer";
import PrintButton from "../PrintButton";

function fmtDate(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

export default async function CustomerInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ buyer?: string }>;
}) {
  const { buyer } = await searchParams;
  if (!buyer) notFound();

  const { sales, payments } = await getCustomerDetail(buyer);
  const totalSales = sales.reduce((sum, s) => sum + s.amount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const outstanding = totalSales - totalPaid;

  // Combine into one chronological statement, oldest first — a running
  // ledger view rather than two separate tables (Channab frames this as
  // "invoice generation" / "payments logged against invoices").
  const lines = [
    ...sales.map((s) => ({ date: s.date, kind: "Sale" as const, detail: `${s.litres} L${s.rate ? ` @ Rs ${s.rate.toFixed(2)}/L` : ""}`, amount: s.amount })),
    ...payments.map((p) => ({ date: p.date, kind: "Payment" as const, detail: `${p.mode}${p.notes ? ` — ${p.notes}` : ""}`, amount: -p.amount })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let running = 0;

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto print:max-w-none">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/admin/reports/milk-sales?buyer=${encodeURIComponent(buyer)}`} className="link-btn">
          ← Back
        </Link>
        <PrintButton />
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-8 print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b border-neutral-200 pb-4 mb-4">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Charlie Dairy Farm</h1>
            <p className="text-sm text-neutral-500">Milk Sales Statement</p>
          </div>
          <div className="text-right text-sm text-neutral-500">
            <p>Statement date: {new Date().toISOString().slice(0, 10)}</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Customer</p>
          <p className="text-lg font-medium text-neutral-900">{buyer}</p>
        </div>

        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="text-xs text-neutral-500 border-b border-neutral-200">
              <th className="text-left py-2 font-normal">Date</th>
              <th className="text-left py-2 font-normal">Type</th>
              <th className="text-left py-2 font-normal">Detail</th>
              <th className="text-right py-2 font-normal">Amount</th>
              <th className="text-right py-2 font-normal">Balance</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              running += line.amount;
              return (
                <tr key={i} className="border-b border-neutral-100">
                  <td className="py-2">{fmtDate(line.date)}</td>
                  <td className="py-2">{line.kind}</td>
                  <td className="py-2 text-neutral-500">{line.detail}</td>
                  <td className="py-2 text-right">{line.amount < 0 ? `(${formatRs(-line.amount)})` : formatRs(line.amount)}</td>
                  <td className="py-2 text-right font-medium">{formatRs(running)}</td>
                </tr>
              );
            })}
            {lines.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-neutral-400">No activity recorded for this customer.</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-neutral-500">Total Sales</span>
              <span>{formatRs(totalSales)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-neutral-500">Total Paid</span>
              <span>{formatRs(totalPaid)}</span>
            </div>
            <div className="flex justify-between py-2 border-t border-neutral-200 font-semibold text-base">
              <span>Outstanding Balance</span>
              <span>{formatRs(outstanding)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
