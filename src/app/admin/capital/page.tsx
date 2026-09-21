import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatRs } from "@/lib/format";
import AddCapitalForm from "./AddCapitalForm";

export default async function CapitalAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ venture?: string }>;
}) {
  const { venture: ventureFilter } = await searchParams;

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

      <AddCapitalForm partners={partners} ventures={ventures} />

      <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from(byPartner.entries()).map(([partner, balance]) => (
          <div key={partner} className="bg-white border border-neutral-200 rounded-lg p-3">
            <div className="text-xs text-neutral-500">{partner}</div>
            <div className={`font-medium ${balance >= 0 ? "text-green-700" : "text-red-600"}`}>{formatRs(balance)}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Partner</th>
              <th className="text-left px-3 py-2">Description</th>
              <th className="text-left px-3 py-2">Venture</th>
              <th className="text-right px-3 py-2">Credit</th>
              <th className="text-right px-3 py-2">Debit</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-neutral-100">
                <td className="px-3 py-2">{e.date.toISOString().slice(0, 10)}</td>
                <td className="px-3 py-2">{e.partner}</td>
                <td className="px-3 py-2">{e.description}</td>
                <td className="px-3 py-2">{e.venture ?? "—"}</td>
                <td className="px-3 py-2 text-right">{e.credit ? formatRs(e.credit) : "—"}</td>
                <td className="px-3 py-2 text-right">{e.debit ? formatRs(e.debit) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
