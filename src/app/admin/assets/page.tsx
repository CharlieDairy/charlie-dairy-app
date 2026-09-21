import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { formatRs } from "@/lib/format";
import AddAssetForm from "./AddAssetForm";

export default async function AssetsAdminPage() {
  const assets = await prisma.asset.findMany({ orderBy: [{ assetClass: "asc" }, { details: "asc" }] });
  const total = assets.reduce((s, a) => s + a.currentValue, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Assets</h1>
        <a
          href="/api/bulk/export?type=assets"
          className="text-sm bg-neutral-800 text-white rounded-md px-3 py-2 font-medium hover:bg-neutral-900"
        >
          Download All (CSV)
        </a>
      </div>
      <AddAssetForm />
      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Photo</th>
              <th className="text-left px-3 py-2">Class</th>
              <th className="text-left px-3 py-2">Details</th>
              <th className="text-right px-3 py-2">Qty</th>
              <th className="text-right px-3 py-2">Current Value</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id} className="border-t border-neutral-100">
                <td className="px-3 py-2">
                  {a.photoUrl ? (
                    <Image src={a.photoUrl} alt={a.details} width={40} height={40} className="rounded object-cover border border-neutral-200" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-neutral-100 border border-neutral-200" />
                  )}
                </td>
                <td className="px-3 py-2">{a.assetClass}</td>
                <td className="px-3 py-2">{a.details}</td>
                <td className="px-3 py-2 text-right">{a.qty}</td>
                <td className="px-3 py-2 text-right">{formatRs(a.currentValue)}</td>
                <td className="px-3 py-2">
                  <Link href={`/admin/assets/${a.id}`} className="text-xs rounded px-2 py-1 border border-neutral-300 text-neutral-700 hover:bg-neutral-100">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-neutral-300 font-medium">
              <td className="px-3 py-2" colSpan={4}>Total</td>
              <td className="px-3 py-2 text-right">{formatRs(total)}</td>
              <td className="px-3 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
