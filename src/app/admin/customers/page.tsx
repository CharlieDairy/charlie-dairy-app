import Link from "next/link";
import StatCard from "@/components/StatCard";
import { formatRs } from "@/lib/format";
import { getCustomersWithSales } from "@/lib/reports/milkSalesByCustomer";
import { resolvePeriod } from "@/lib/period";
import CustomersTable from "./CustomersTable";
import FilterBar from "./FilterBar";
import AddCustomerToggle from "./AddCustomerToggle";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; period?: string }>;
}) {
  const params = await searchParams;
  const status = params.status === "hidden" || params.status === "all" ? params.status : "active";
  const period = await resolvePeriod(params.period, "month");

  const all = await getCustomersWithSales(period);
  const rows = status === "all" ? all : all.filter((c) => (status === "active" ? c.active : !c.active));

  const totalLitres = rows.reduce((n, r) => n + r.totalLitres, 0);
  const totalRevenue = rows.reduce((n, r) => n + r.totalSaleAmount, 0);
  const totalOutstanding = rows.reduce((n, r) => n + r.outstandingBalance, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Customers</h1>
        <div className="flex items-center gap-3">
          <Link href="/entry/milk-sale" className="text-sm text-primary underline">+ Add Sale</Link>
          <AddCustomerToggle />
        </div>
      </div>
      <p className="text-sm text-neutral-500 max-w-2xl">
        Milk buyers with contact details, payment terms, agreed rate and their sales summary in one place. Matched by
        name against Milk Sale Entry&apos;s buyer field — the agreed rate there auto-fills when it recognizes a customer.
      </p>

      <FilterBar status={status} period={period} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
        <StatCard label="Customers" value={rows.length.toString()} />
        <StatCard label="Total Sales" value={`${totalLitres.toLocaleString()} L · ${formatRs(totalRevenue)}`} />
        <StatCard label="Outstanding" value={formatRs(totalOutstanding)} tone={totalOutstanding > 0 ? "negative" : "positive"} />
      </div>

      <CustomersTable rows={rows} />
    </div>
  );
}
