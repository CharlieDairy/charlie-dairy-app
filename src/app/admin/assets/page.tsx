import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { formatRs } from "@/lib/format";
import StatCard from "@/components/StatCard";
import AddAssetForm from "./AddAssetForm";
import AssetsTable from "./AssetsTable";
import BulkTypeSection from "@/app/admin/bulk/BulkTypeSection";
import { getBulkTypeMeta } from "@/lib/bulk/registry";

export default async function AssetsAdminPage() {
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";
  const [assets, dairyCapital] = await Promise.all([
    prisma.asset.findMany({ orderBy: [{ assetClass: "asc" }, { details: "asc" }] }),
    // Same scope the Balance Sheet uses for equity (venture "Dairy" only).
    prisma.capitalEntry.aggregate({ where: { venture: "Dairy" }, _sum: { credit: true, debit: true } }),
  ]);
  const bulkMeta = getBulkTypeMeta("assets")!;

  const totalCost = assets.reduce((n, a) => n + a.value, 0);
  const totalCurrent = assets.reduce((n, a) => n + a.currentValue, 0);
  const capitalNet = (dairyCapital._sum.credit ?? 0) - (dairyCapital._sum.debit ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Assets</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Asset Lines" value={assets.length.toLocaleString()} />
        <StatCard label="Total Cost Value" value={formatRs(totalCost)} />
        <StatCard label="Total Current Value" value={formatRs(totalCurrent)} />
        <StatCard label="Capital Ledger (Dairy, net)" value={formatRs(capitalNet)} />
      </div>
      <div className="-mt-3">
        <Link href="/admin/capital?venture=Dairy" className="link-btn">Open Capital Ledger →</Link>
      </div>

      <AddAssetForm />
      <BulkTypeSection meta={bulkMeta} />
      <AssetsTable assets={assets} isAdmin={isAdmin} />
    </div>
  );
}
