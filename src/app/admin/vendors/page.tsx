import Link from "next/link";
import StatCard from "@/components/StatCard";
import { formatRs } from "@/lib/format";
import { getVendorsWithSpend } from "@/lib/reports/vendorLedger";
import { resolvePeriod } from "@/lib/period";
import PeriodBar from "@/components/PeriodBar";
import VendorsTable from "./VendorsTable";
import AddVendorToggle from "./AddVendorToggle";

const STATUS_OPTIONS = [
  { key: "active", label: "Active" },
  { key: "hidden", label: "Hidden" },
  { key: "all", label: "All" },
];

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; period?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const status = params.status === "hidden" || params.status === "all" ? params.status : "active";
  const { period, from, to } = await resolvePeriod(params, "month");

  const all = await getVendorsWithSpend(period, from, to);
  const rows = status === "all" ? all : all.filter((v) => (status === "active" ? v.active : !v.active));

  const totalSpent = rows.reduce((n, r) => n + r.totalSpent, 0);
  const totalTxns = rows.reduce((n, r) => n + r.txnCount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Vendor Ledger</h1>
        <AddVendorToggle />
      </div>
      <p className="text-base font-semibold text-neutral-600">
        Suppliers with contact details and their spend summary in one place. Matched by name against Cash Entry&apos;s
        Party field, so any past payment to a matching name shows up here automatically.
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
        <StatCard label="Vendors" value={rows.length.toString()} />
        <StatCard label="Total Spent" value={formatRs(totalSpent)} />
        <StatCard label="Transactions" value={totalTxns.toString()} />
      </div>

      <VendorsTable rows={rows} />
    </div>
  );
}
