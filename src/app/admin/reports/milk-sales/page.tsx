import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Card from "@/components/Card";
import StatCard from "@/components/StatCard";
import { formatRs } from "@/lib/format";
import { getCustomerDetail, getDistinctBuyers } from "@/lib/reports/milkSalesByCustomer";
import { getActiveWithdrawals } from "@/lib/reports/withdrawal";
import { periodRange } from "@/lib/reports/herd";
import { resolvePeriod } from "@/lib/period";
import type { LedgerSaleRow } from "@/app/entry/milk-sale/MilkSalesLedger";
import MilkSalesLedger from "@/app/entry/milk-sale/MilkSalesLedger";
import WithdrawalWarningBanner from "@/components/WithdrawalWarningBanner";
import PeriodBar from "@/components/PeriodBar";
import RecordPaymentForm from "./RecordPaymentForm";

function fmtDate(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

export default async function MilkSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ buyer?: string; period?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { period, from, to } = await resolvePeriod(params, "month");
  const range = periodRange(period, new Date(), from, to);

  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const [customers, buyers, sales, detail, activeWithdrawals] = await Promise.all([
    prisma.customer.findMany({ where: { active: true }, select: { id: true, name: true, agreedRate: true }, orderBy: { name: "asc" } }),
    getDistinctBuyers(),
    prisma.milkSale.findMany({
      where: {
        date: { gte: range.start, lt: range.end },
        ...(params.buyer ? { buyer: params.buyer } : {}),
      },
      orderBy: { date: "desc" },
      select: { id: true, date: true, buyer: true, shift: true, litres: true, rate: true, amount: true },
    }),
    params.buyer ? getCustomerDetail(params.buyer) : null,
    getActiveWithdrawals(),
  ]);

  const customerIdByName = new Map(customers.map((c) => [c.name, c.id]));
  const ledgerRows: LedgerSaleRow[] = sales.map((s) => ({
    id: s.id,
    date: s.date.toISOString().slice(0, 10),
    buyer: s.buyer,
    customerId: customerIdByName.get(s.buyer) ?? null,
    shift: s.shift,
    litres: s.litres,
    rate: s.rate,
    amount: s.amount,
  }));

  const sum = (shift: "MORNING" | "AFTERNOON" | "EVENING" | null) =>
    sales.filter((s) => s.shift === shift).reduce((n, s) => n + s.litres, 0);
  const morning = sum("MORNING");
  const afternoon = sum("AFTERNOON");
  const evening = sum("EVENING");
  const total = sales.reduce((n, s) => n + s.litres, 0);
  const totalAmount = sales.reduce((n, s) => n + s.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Milk Sales</h1>
        <div className="flex items-center gap-2">
          <Link href="/entry/milk-sale" className="text-primary underline text-sm">+ Record a sale →</Link>
          <a href="/api/bulk/export?type=milkSales" className="bg-neutral-800 text-white rounded-md px-3 py-2 text-sm font-medium hover:bg-neutral-900">
            Download CSV
          </a>
        </div>
      </div>
      <p className="text-xs text-neutral-400 -mt-4">Sales are recorded on Milk Sale Entry — this page is a browsable report of what&apos;s already been recorded.</p>

      <PeriodBar period={period} from={from} to={to} extraParams={params.buyer ? { buyer: params.buyer } : undefined} />

      {params.buyer && (
        <div className="flex items-center gap-3 text-sm bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          <span>Viewing: <strong>{params.buyer}</strong></span>
          <Link href="/admin/reports/milk-sales" className="text-primary underline">Clear filter</Link>
          <Link href={`/admin/reports/milk-sales/invoice?buyer=${encodeURIComponent(params.buyer)}`} className="text-primary underline ml-auto">
            Print Statement
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="1st Sale" value={`${morning.toLocaleString()} L`} />
        <StatCard label="2nd Sale" value={`${afternoon.toLocaleString()} L`} />
        <StatCard label="3rd Sale" value={`${evening.toLocaleString()} L`} />
        <StatCard label="Total" value={`${total.toLocaleString()} L · ${formatRs(totalAmount)}`} />
      </div>

      <WithdrawalWarningBanner withdrawals={activeWithdrawals} />

      <MilkSalesLedger sales={ledgerRows} showSessions customers={customers} isAdmin={isAdmin} />

      <Card>
        <h2 className="font-semibold text-text mb-2">Record a Payment</h2>
        <RecordPaymentForm buyers={buyers} defaultBuyer={params.buyer} />
      </Card>

      {detail && params.buyer && (
        <Card>
          <h2 className="font-semibold text-text mb-3">{params.buyer} — Payments</h2>
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
        </Card>
      )}
    </div>
  );
}
