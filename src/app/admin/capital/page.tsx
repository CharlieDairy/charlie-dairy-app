import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { formatRs } from "@/lib/format";
import StatCard from "@/components/StatCard";
import AddCapitalForm from "./AddCapitalForm";
import CapitalLedgerTable from "./CapitalLedgerTable";

export default async function CapitalAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ venture?: string }>;
}) {
  const { venture: ventureFilter } = await searchParams;
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const [entries, ventureRows, partnerRows] = await Promise.all([
    prisma.capitalEntry.findMany({
      where: ventureFilter ? { venture: ventureFilter } : {},
      orderBy: { date: "asc" },
    }),
    prisma.capitalEntry.findMany({ select: { venture: true }, distinct: ["venture"] }),
    prisma.capitalEntry.findMany({ select: { partner: true }, distinct: ["partner"] }),
  ]);

  const ventures = ventureRows.map((v) => v.venture).filter((v): v is string => !!v).sort();
  const partners = partnerRows.map((p) => p.partner).sort();

  const totalCredit = entries.reduce((n, e) => n + e.credit, 0);
  const totalDebit = entries.reduce((n, e) => n + e.debit, 0);

  const byPartner = new Map<string, number>();
  for (const e of entries) {
    byPartner.set(e.partner, (byPartner.get(e.partner) ?? 0) + e.credit - e.debit);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Capital Ledger</h1>
      <p className="text-sm text-neutral-500">
        Spans multiple ventures (Dairy, Fattening, various loan tranches) tracked by the same partner group.
        Filter by venture below to see Charlie Dairy-specific entries only.
      </p>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/capital" className={`px-3 py-1 rounded-full border ${!ventureFilter ? "bg-green-700 text-white border-green-700" : "border-neutral-300 text-neutral-700"}`}>
          All ventures
        </Link>
        {ventures.map((v) => (
          <Link key={v} href={`/admin/capital?venture=${encodeURIComponent(v)}`} className={`px-3 py-1 rounded-full border ${ventureFilter === v ? "bg-green-700 text-white border-green-700" : "border-neutral-300 text-neutral-700"}`}>
            {v}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Entries" value={entries.length.toLocaleString()} />
        <StatCard label="Total Credit (in)" value={formatRs(totalCredit)} />
        <StatCard label="Total Debit (out)" value={formatRs(totalDebit)} />
        <StatCard label={`Capital Ledger Total${ventureFilter ? ` — ${ventureFilter}` : ""}`} value={formatRs(totalCredit - totalDebit)} />
      </div>

      <AddCapitalForm partners={partners} ventures={ventures} />

      <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from(byPartner.entries()).map(([partner, balance]) => (
          <div key={partner} className="bg-white border border-neutral-200 rounded-lg p-3">
            <div className="text-xs text-neutral-500">{partner}</div>
            <div className={`font-medium ${balance >= 0 ? "text-green-700" : "text-red-600"}`}>{formatRs(balance)}</div>
          </div>
        ))}
      </div>

      <CapitalLedgerTable
        entries={entries.map((e) => ({
          id: e.id,
          date: e.date.toISOString().slice(0, 10),
          partner: e.partner,
          description: e.description,
          venture: e.venture,
          credit: e.credit,
          debit: e.debit,
        }))}
        partners={partners}
        ventures={ventures}
        isAdmin={isAdmin}
      />
    </div>
  );
}
