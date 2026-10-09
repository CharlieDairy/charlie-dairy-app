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
import RecordPaymentButton from "./RecordPaymentButton";
import RecordActions from "@/components/RecordActions";
import { getLiveUser, hasPermission } from "@/lib/access";
import { updateCustomerPayment, deleteCustomerPayment, updateMilkUsage, deleteMilkUsage } from "./recordActions";

const USE_LABEL: Record<string, string> = { CALF_USE: "Calf use", FARM_USE: "Farm use", EMPLOYEE_USE: "Farm employee" };

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
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canEdit = role === "ADMIN" || role === "EDITOR";
  const live = await getLiveUser();
  const canEditMilk = !!live && hasPermission(live, "milk", "EDIT");
  const canDeleteMilk = !!live && hasPermission(live, "milk", "DELETE");
  const usage = await prisma.milkUsageRecord.findMany({ where: { date: { gte: range.start, lt: range.end } }, orderBy: { date: "desc" } });

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
          <Link href="/entry/milk-sale" className="link-btn link-btn-primary">+ Record a sale →</Link>
          <RecordPaymentButton customers={customers} defaultCustomer={params.buyer} />
          <a href="/api/bulk/export?type=milkSales" className="bg-neutral-800 text-white rounded-md px-3 py-2 text-sm font-medium hover:bg-neutral-900">
            Download CSV
          </a>
        </div>
      </div>
      <p className="text-sm font-semibold text-neutral-500 -mt-4">Sales are recorded on Milk Sale Entry — this page is a browsable report of what&apos;s already been recorded.</p>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white p-3">
        <span className="text-xs font-semibold text-text-muted">CUSTOMER</span>
        {[{ key: "", label: "All" }, ...buyers.map((b) => ({ key: b, label: b }))].map((c) => {
          const qs = new URLSearchParams({ period });
          if (period === "custom" && from && to) {
            qs.set("from", from);
            qs.set("to", to);
          }
          if (c.key) qs.set("buyer", c.key);
          const active = (params.buyer ?? "") === c.key;
          return (
            <Link
              key={c.key || "all"}
              href={`?${qs.toString()}`}
              className={`rounded-full border px-3 py-2 text-xs ${
                active ? "bg-primary text-white border-primary" : "border-border text-text-muted hover:bg-primary-light"
              }`}
            >
              {c.label}
            </Link>
          );
        })}
        {params.buyer && (
          <Link href={`/admin/reports/milk-sales/invoice?buyer=${encodeURIComponent(params.buyer)}`} className="link-btn ml-auto">
            Print Statement
          </Link>
        )}
      </div>

      <PeriodBar period={period} from={from} to={to} extraParams={params.buyer ? { buyer: params.buyer } : undefined} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="1st Sale" value={`${morning.toLocaleString()} L`} />
        <StatCard label="2nd Sale" value={`${afternoon.toLocaleString()} L`} />
        <StatCard label="3rd Sale" value={`${evening.toLocaleString()} L`} />
        <StatCard label="Total" value={`${total.toLocaleString()} L · ${formatRs(totalAmount)}`} />
      </div>

      <WithdrawalWarningBanner withdrawals={activeWithdrawals} />

      <MilkSalesLedger sales={ledgerRows} showSessions customers={customers} isAdmin={canEdit} />

      {!params.buyer && (
        <Card>
          <h2 className="font-semibold text-text mb-1">Milk used on the farm</h2>
          <p className="text-xs text-text-muted mb-3">Calf, farm and employee use in this period (recorded from Milk Sale Entry).</p>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-neutral-500">
                <th className="text-left py-1 font-normal">Date</th>
                <th className="text-left py-1 font-normal">Use</th>
                <th className="text-right py-1 font-normal">Litres</th>
                <th className="text-left py-1 pl-3 font-normal">Notes</th>
                <th className="py-1 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {usage.map((u) => (
                <tr key={u.id} className="border-t border-neutral-100">
                  <td className="py-1">{fmtDate(u.date)}</td>
                  <td className="py-1">{USE_LABEL[u.type] ?? u.type}</td>
                  <td className="py-1 text-right">{u.litres.toLocaleString()} L</td>
                  <td className="py-1 pl-3 text-neutral-500">{u.notes ?? ""}</td>
                  <td className="py-1 text-right">
                    <RecordActions
                      id={u.id}
                      title={`${USE_LABEL[u.type] ?? u.type} ${fmtDate(u.date)}`}
                      canEdit={canEditMilk}
                      canDelete={canDeleteMilk}
                      updateAction={updateMilkUsage}
                      deleteAction={deleteMilkUsage}
                      deleteConfirm={`Delete ${u.litres} L of ${USE_LABEL[u.type] ?? u.type} on ${fmtDate(u.date)}?`}
                      fields={[
                        { name: "date", label: "Date", type: "date", value: fmtDate(u.date), required: true },
                        { name: "type", label: "Use", type: "select", required: true, value: u.type, options: [{ value: "CALF_USE", label: "Calf use" }, { value: "FARM_USE", label: "Farm use" }, { value: "EMPLOYEE_USE", label: "Farm employee" }] },
                        { name: "litres", label: "Litres", type: "number", step: "0.1", value: String(u.litres), required: true },
                        { name: "notes", label: "Notes", type: "textarea", value: u.notes ?? "" },
                      ]}
                    />
                  </td>
                </tr>
              ))}
              {usage.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-center text-neutral-400">No internal use recorded in this period.</td>
                </tr>
              )}
            </tbody>
          </table></div>
        </Card>
      )}

      {detail && params.buyer && (
        <Card>
          <h2 className="font-semibold text-text mb-3">{params.buyer} — Payments</h2>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-neutral-500">
                <th className="text-left py-1 font-normal">Date</th>
                <th className="text-left py-1 font-normal">Mode</th>
                <th className="text-right py-1 font-normal">Amount</th>
                <th className="py-1 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {detail.payments.map((p) => (
                <tr key={p.id} className="border-t border-neutral-100">
                  <td className="py-1">{fmtDate(p.date)}</td>
                  <td className="py-1">{p.mode}</td>
                  <td className="py-1 text-right">{formatRs(p.amount)}</td>
                  <td className="py-1 text-right">
                    <RecordActions
                      id={p.id}
                      title={`Payment ${fmtDate(p.date)}`}
                      canEdit={canEditMilk}
                      canDelete={canDeleteMilk}
                      updateAction={updateCustomerPayment}
                      deleteAction={deleteCustomerPayment}
                      deleteConfirm={`Delete the ${formatRs(p.amount)} payment on ${fmtDate(p.date)}? Its Cash Register entry is removed too.`}
                      fields={[
                        { name: "date", label: "Date", type: "date", value: fmtDate(p.date), required: true },
                        { name: "amount", label: "Amount", type: "number", step: "1", value: String(p.amount), required: true },
                        { name: "mode", label: "Mode", type: "select", required: true, value: p.mode, options: [{ value: "CASH", label: "Cash" }, { value: "BANK", label: "Bank" }] },
                        { name: "notes", label: "Notes", type: "textarea", value: "" },
                      ]}
                    />
                  </td>
                </tr>
              ))}
              {detail.payments.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-neutral-400">No payments recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table></div>
        </Card>
      )}
    </div>
  );
}
