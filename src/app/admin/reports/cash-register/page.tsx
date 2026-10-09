import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import StatCard from "@/components/StatCard";
import { formatRs } from "@/lib/format";
import { periodRange } from "@/lib/reports/herd";
import { resolvePeriod } from "@/lib/period";
import PeriodBar from "@/components/PeriodBar";
import AddEntryToggle from "./AddEntryToggle";
import { CLASS_LABEL, classifyCash } from "@/lib/accounting/cashClass";
import CashRegisterTable from "./CashRegisterTable";

export default async function CashRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { period, from, to } = await resolvePeriod(params, "month");
  const range = periodRange(period, new Date(), from, to);

  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const [transactions, categoryRows, vendors, customers] = await Promise.all([
    prisma.cashTransaction.findMany({
      where: { date: { gte: range.start, lt: range.end } },
      orderBy: { date: "desc" },
      select: { id: true, date: true, category: true, party: true, mode: true, remark: true, amountIn: true, amountOut: true, accountClass: true },
    }),
    prisma.cashTransaction.findMany({ select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } }),
    prisma.vendor.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  const categories = categoryRows.map((r) => r.category);
  const vendorNames = vendors.map((v) => v.name);

  const totalIn = transactions.reduce((n, t) => n + t.amountIn, 0);
  const totalOut = transactions.reduce((n, t) => n + t.amountOut, 0);

  const rows = transactions.map((t) => ({
    id: t.id,
    date: t.date.toISOString().slice(0, 10),
    category: t.category,
    party: t.party,
    mode: t.mode,
    remark: t.remark,
    amountIn: t.amountIn,
    amountOut: t.amountOut,
    cls: classifyCash(t),
    clsLabel: CLASS_LABEL[classifyCash(t)],
    manualClass: t.accountClass,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Cash Register</h1>
      <p className="text-base font-semibold text-neutral-600">
        Every cash and bank transaction, in one place — book a new entry and search, edit or delete anything
        already recorded.
      </p>
      <PeriodBar period={period} from={from} to={to} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total In" value={formatRs(totalIn)} tone="positive" />
        <StatCard label="Total Out" value={formatRs(totalOut)} tone="negative" />
        <StatCard label="Net" value={formatRs(totalIn - totalOut)} />
      </div>

      <AddEntryToggle categories={categories} vendorNames={vendorNames} customerNames={customers.map((c) => c.name)} />

      <CashRegisterTable entries={rows} categories={categories} vendorNames={vendorNames} isAdmin={isAdmin} />
    </div>
  );
}
