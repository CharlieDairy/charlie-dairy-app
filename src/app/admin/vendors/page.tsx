import StatCard from "@/components/StatCard";
import { formatRs } from "@/lib/format";
import { getVendorsWithSpend } from "@/lib/reports/vendorLedger";
import type { PeriodKey } from "@/lib/reports/herd";
import VendorsTable from "./VendorsTable";
import FilterBar from "./FilterBar";
import AddVendorToggle from "./AddVendorToggle";

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; period?: string }>;
}) {
  const params = await searchParams;
  const status = params.status === "hidden" || params.status === "all" ? params.status : "active";
  const period: PeriodKey = (["day", "week", "month", "year", "all"] as const).includes(params.period as PeriodKey)
    ? (params.period as PeriodKey)
    : "month";

  const all = await getVendorsWithSpend(period);
  const rows = status === "all" ? all : all.filter((v) => (status === "active" ? v.active : !v.active));

  const totalSpent = rows.reduce((n, r) => n + r.totalSpent, 0);
  const totalTxns = rows.reduce((n, r) => n + r.txnCount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Vendor Ledger</h1>
        <AddVendorToggle />
      </div>
      <p className="text-sm text-neutral-500 max-w-2xl">
        Suppliers with contact details and their spend summary in one place. Matched by name against Cash Entry&apos;s
        Party field, so any past payment to a matching name shows up here automatically.
      </p>

      <FilterBar status={status} period={period} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
        <StatCard label="Vendors" value={rows.length.toString()} />
        <StatCard label="Total Spent" value={formatRs(totalSpent)} />
        <StatCard label="Transactions" value={totalTxns.toString()} />
      </div>

      <VendorsTable rows={rows} />
    </div>
  );
}
