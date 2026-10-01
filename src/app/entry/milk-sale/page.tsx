import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTodaysSellableBalance, getProductionReconciliation } from "@/lib/reports/reconciliation";
import { getActiveWithdrawals } from "@/lib/reports/withdrawal";
import { getCustomerSalesSummary } from "@/lib/reports/milkSalesByCustomer";
import { periodRange, type PeriodKey } from "@/lib/reports/herd";
import StatCard from "@/components/StatCard";
import WithdrawalWarningBanner from "@/components/WithdrawalWarningBanner";
import MilkSaleForm from "./MilkSaleForm";
import MilkSalesLedger, { type LedgerSaleRow } from "./MilkSalesLedger";
import { formatRs } from "@/lib/format";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "day", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "all", label: "All Time" },
];

export default async function MilkSaleEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period: PeriodKey = PERIODS.some((p) => p.key === params.period) ? (params.period as PeriodKey) : "week";
  const range = periodRange(period);

  const [rows, customers, balance, sales, activeWithdrawals, todayReconciliation, customerBalances] = await Promise.all([
    prisma.milkSale.findMany({
      select: { buyer: true },
      distinct: ["buyer"],
      orderBy: { buyer: "asc" },
    }),
    prisma.customer.findMany({ where: { active: true }, select: { name: true, agreedRate: true } }),
    getTodaysSellableBalance(),
    prisma.milkSale.findMany({
      where: range ? { date: { gte: range.start, lt: range.end } } : undefined,
      orderBy: { date: "desc" },
      select: { id: true, date: true, buyer: true, shift: true, litres: true, rate: true, amount: true },
    }),
    getActiveWithdrawals(),
    getProductionReconciliation("day"),
    getCustomerSalesSummary("all"),
  ]);
  const todayRow = todayReconciliation[0];
  const outstandingCustomers = customerBalances.filter((c) => c.outstandingBalance > 0.5).slice(0, 8);
  const buyers = Array.from(new Set([...customers.map((c) => c.name), ...rows.map((r) => r.buyer)])).sort();

  const ledgerRows: LedgerSaleRow[] = sales.map((s) => ({
    id: s.id,
    date: s.date.toISOString().slice(0, 10),
    buyer: s.buyer,
    shift: s.shift,
    litres: s.litres,
    rate: s.rate,
    amount: s.amount,
  }));
  const totalLitres = sales.reduce((n, s) => n + s.litres, 0);
  const totalRevenue = sales.reduce((n, s) => n + s.amount, 0);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900">Milk Sale Entry</h1>
      <WithdrawalWarningBanner withdrawals={activeWithdrawals} />
      <div className="flex flex-wrap gap-3">
        <div className="max-w-md rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm flex-1 min-w-[260px]">
          <p className="font-medium text-neutral-700">Available to sell today: {balance.available.toFixed(1)} L</p>
          <p className="text-xs text-neutral-500 mt-1">
            {balance.produced.toFixed(1)} L produced − {(balance.calfUse + balance.farmUse + balance.employeeUse).toFixed(1)} L
            calf/farm/employee use − {balance.sold.toFixed(1)} L already sold today. Guidance only, not enforced — opening
            stock or multi-day carryover isn&apos;t reflected here.
          </p>
          {todayRow && (
            <p className="text-xs text-neutral-500 mt-2 border-t border-neutral-200 pt-2">
              Reconciliation: opening {todayRow.openingBalanceLitres.toFixed(1)} L → closing {todayRow.closingBalanceLitres.toFixed(1)} L
              ({todayRow.varianceLitres >= 0 ? "+" : ""}{todayRow.varianceLitres.toFixed(1)} L unexplained today)
            </p>
          )}
          <div className="flex gap-3 mt-2 text-xs">
            <Link href="/admin/reports/reconciliation" className="text-primary underline">View full reconciliation →</Link>
            <Link href="/admin/reports/reconciliation#record-use" className="text-primary underline">Record Calf/Farm/Employee Use →</Link>
          </div>
        </div>

        {outstandingCustomers.length > 0 && (
          <div className="max-w-md rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm flex-1 min-w-[260px]">
            <p className="font-medium text-neutral-700">Customer outstanding</p>
            <ul className="mt-1 flex flex-col gap-1">
              {outstandingCustomers.map((c) => (
                <li key={c.buyer} className="flex items-center justify-between text-xs text-neutral-600">
                  <span>{c.buyer}</span>
                  <span className="font-medium text-neutral-800">{formatRs(c.outstandingBalance)}</span>
                </li>
              ))}
            </ul>
            <Link href="/admin/reports/ar-aging" className="text-primary underline text-xs mt-2 inline-block">View full AR aging →</Link>
          </div>
        )}
      </div>
      <MilkSaleForm buyers={buyers} customerRates={customers.filter((c) => c.agreedRate !== null).map((c) => ({ name: c.name, agreedRate: c.agreedRate as number }))} />

      <div className="flex items-center justify-between flex-wrap gap-3 mt-4">
        <h2 className="text-sm font-semibold text-neutral-700">Recent Sales</h2>
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
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <StatCard label="Litres Sold" value={totalLitres.toLocaleString()} />
        <StatCard label="Revenue" value={`Rs ${totalRevenue.toLocaleString()}`} />
      </div>
      <MilkSalesLedger sales={ledgerRows} />
    </div>
  );
}
