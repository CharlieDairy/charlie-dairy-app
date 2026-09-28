import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import AddAssetForm from "./AddAssetForm";
import AssetsTable from "./AssetsTable";
import BulkTypeSection from "@/app/admin/bulk/BulkTypeSection";
import { getBulkTypeMeta } from "@/lib/bulk/registry";

export default async function AssetsAdminPage() {
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";
  const assets = await prisma.asset.findMany({ orderBy: [{ assetClass: "asc" }, { details: "asc" }] });
  const bulkMeta = getBulkTypeMeta("assets")!;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Assets</h1>
      <AddAssetForm />
      <BulkTypeSection meta={bulkMeta} />
      <AssetsTable assets={assets} isAdmin={isAdmin} />
    </div>
  );
}
