import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EditAssetForm from "./EditAssetForm";

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Edit Asset</h1>
        <Link href="/admin/assets" className="text-sm text-neutral-500 underline">
          ← Back to Assets
        </Link>
      </div>
      <EditAssetForm asset={asset} />
    </div>
  );
}
