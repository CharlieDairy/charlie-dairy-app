import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import StatCard from "@/components/StatCard";
import { formatRs } from "@/lib/format";
import { periodRange, type PeriodKey } from "@/lib/reports/herd";
import PeriodSelect from "./PeriodSelect";
import AddEntryToggle from "./AddEntryToggle";
import CashRegisterTable from "./CashRegisterTable";

export default async function CashRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period: PeriodKey = (["day", "week", "month", "year", "all"] as const).includes(params.period as PeriodKey)
    ? (params.period as PeriodKey)
    : "month";
  const range = periodRange(period);

  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const [transactions, categoryRows, vendors] = await Promise.all([
    prisma.cashTransaction.findMany({
      where: range ? { date: { gte: range.start, lt: range.end } } : undefined,
      orderBy: { date: "desc" },
      select: { id: true, date: true, category: true, party: true, mode: true, remark: true, amountIn: true, amountOut: true },
    }),
    prisma.cashTransaction.findMany({ select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } }),
    prisma.vendor.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
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
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Cash Register</h1>
        <PeriodSelect period={period} />
      </div>
      <p className="text-sm text-neutral-500 max-w-2xl">
        Every cash and bank transaction, in one place — book a new entry and search, edit or delete anything
        already recorded.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
        <StatCard label="Total In" value={formatRs(totalIn)} tone="positive" />
        <StatCard label="Total Out" value={formatRs(totalOut)} tone="negative" />
        <StatCard label="Net" value={formatRs(totalIn - totalOut)} />
      </div>

      <AddEntryToggle categories={categories} vendorNames={vendorNames} />

      <CashRegisterTable entries={rows} categories={categories} vendorNames={vendorNames} isAdmin={isAdmin} />
    </div>
  );
}
