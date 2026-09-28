import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import StatCard from "@/components/StatCard";
import { formatRs } from "@/lib/format";
import { auth } from "@/auth";
import { getCustomerSalesSummary, getCustomerDetail, getDistinctBuyers } from "@/lib/reports/milkSalesByCustomer";
import type { PeriodKey } from "@/lib/reports/herd";
import CustomerSalesTable from "./CustomerSalesTable";
import RecordPaymentForm from "./RecordPaymentForm";

function fmtDate(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "day", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "all", label: "All Time" },
];

export default async function MilkSalesByCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ buyer?: string; period?: string }>;
}) {
  const params = await searchParams;
  const period: PeriodKey = PERIODS.some((p) => p.key === params.period) ? (params.period as PeriodKey) : "month";
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";
  const [summary, buyers] = await Promise.all([getCustomerSalesSummary(period), getDistinctBuyers()]);
  const detail = params.buyer ? await getCustomerDetail(params.buyer) : null;

  const totalLitres = summary.reduce((n, s) => n + s.totalLitres, 0);
  const totalRevenue = summary.reduce((n, s) => n + s.totalSaleAmount, 0);
  const totalOutstanding = summary.reduce((n, s) => n + s.outstandingBalance, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Milk Sales by Customer" />
      <p className="text-sm text-neutral-500 max-w-2xl">
        Every customer&apos;s sales, rate, and running balance. Recording a payment here also creates a real entry in
        the Cash ledger — it shows up in Cash Flow and P&amp;L immediately, not as a separate untracked number.
        Outstanding balance is always lifetime; Sales/Revenue reflect the selected period.
      </p>

      <div className="flex gap-1.5 flex-wrap">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`?period=${p.key}`}
            className={`text-xs rounded-full px-3 py-1.5 border ${
              period === p.key ? "bg-primary text-white border-primary" : "border-border text-text-muted hover:bg-neutral-100"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
        <StatCard label="Customers" value={summary.length.toString()} />
        <StatCard label="Total Sales" value={`${totalLitres.toLocaleString()} L · ${formatRs(totalRevenue)}`} />
        <StatCard label="Outstanding" value={formatRs(totalOutstanding)} tone={totalOutstanding > 0 ? "negative" : "positive"} />
      </div>

      <CustomerSalesTable rows={summary} isAdmin={isAdmin} />

      <Card>
        <h2 className="font-semibold text-text mb-2">Record a Payment</h2>
        <RecordPaymentForm buyers={buyers} defaultBuyer={params.buyer} />
      </Card>

      {detail && params.buyer && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-text">{params.buyer} — Detail</h2>
            <div className="flex items-center gap-4">
              <Link href={`/admin/reports/milk-sales/invoice?buyer=${encodeURIComponent(params.buyer)}`} className="text-sm text-green-700 underline font-medium">
                Print Statement
              </Link>
              <Link href="/admin/reports/milk-sales" className="text-sm text-neutral-500 underline">
                Clear selection
              </Link>
            </div>
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
