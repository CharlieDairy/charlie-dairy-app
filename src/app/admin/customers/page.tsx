import Link from "next/link";
import { auth } from "@/auth";
import StatCard from "@/components/StatCard";
import { formatRs } from "@/lib/format";
import { getCustomersWithSales } from "@/lib/reports/milkSalesByCustomer";
import { resolvePeriod } from "@/lib/period";
import CustomersTable from "./CustomersTable";
import AddCustomerToggle from "./AddCustomerToggle";
import PeriodBar from "@/components/PeriodBar";

const STATUS_OPTIONS = [
  { key: "active", label: "Active" },
  { key: "hidden", label: "Hidden" },
  { key: "all", label: "All" },
];

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; period?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const status = params.status === "hidden" || params.status === "all" ? params.status : "active";
  const { period, from, to } = await resolvePeriod(params, "month");

  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const all = await getCustomersWithSales(period, from, to);
  const rows = status === "all" ? all : all.filter((c) => (status === "active" ? c.active : !c.active));

  const totalLitres = rows.reduce((n, r) => n + r.totalLitres, 0);
  const totalRevenue = rows.reduce((n, r) => n + r.totalSaleAmount, 0);
  const totalOutstanding = rows.reduce((n, r) => n + r.outstandingBalance, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Customers</h1>
        <div className="flex items-center gap-3">
          <Link href="/entry/milk-sale" className="link-btn link-btn-primary">+ Record a Sale</Link>
          {isAdmin && <AddCustomerToggle />}
        </div>
      </div>
      <p className="text-base font-semibold text-neutral-600">
        Milk buyers with contact details, payment terms, agreed rate and their sales summary in one place. Matched by
        name against Milk Sale Entry&apos;s buyer field. Only an Admin can add a customer or change their agreed rate —
        that rate is the fixed price Milk Sale Entry uses, so every sale is priced exactly as approved.
      </p>

      <div className="flex gap-1.5 flex-wrap">
        {STATUS_OPTIONS.map((s) => (
          <Link
            key={s.key}
            href={`?status=${s.key}&period=${period}`}
            className={`text-xs rounded-full px-3 py-1.5 border ${
              status === s.key ? "bg-primary text-white border-primary" : "border-border text-text-muted hover:bg-neutral-100"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>
      <PeriodBar period={period} from={from} to={to} extraParams={{ status }} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Customers" value={rows.length.toString()} />
        <StatCard label="Total Sales (Litres)" value={`${totalLitres.toLocaleString()} L`} />
        <StatCard label="Total Sales (Rs)" value={formatRs(totalRevenue)} />
        <StatCard label="Outstanding" value={formatRs(totalOutstanding)} tone={totalOutstanding > 0 ? "negative" : "positive"} />
      </div>

      <CustomersTable rows={rows} isAdmin={isAdmin} />
    </div>
  );
}
