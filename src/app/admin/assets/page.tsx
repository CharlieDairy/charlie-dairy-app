import { prisma } from "@/lib/prisma";
import { formatRs } from "@/lib/format";
import AddAssetForm from "./AddAssetForm";

export default async function AssetsAdminPage() {
  const assets = await prisma.asset.findMany({ orderBy: [{ assetClass: "asc" }, { details: "asc" }] });
  const total = assets.reduce((s, a) => s + a.currentValue, 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Assets</h1>
      <AddAssetForm />
      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Class</th>
              <th className="text-left px-3 py-2">Details</th>
              <th className="text-right px-3 py-2">Qty</th>
              <th className="text-right px-3 py-2">Current Value</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id} className="border-t border-neutral-100">
                <td className="px-3 py-2">{a.assetClass}</td>
                <td className="px-3 py-2">{a.details}</td>
                <td className="px-3 py-2 text-right">{a.qty}</td>
                <td className="px-3 py-2 text-right">{formatRs(a.currentValue)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-neutral-300 font-medium">
              <td className="px-3 py-2" colSpan={3}>Total</td>
              <td className="px-3 py-2 text-right">{formatRs(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
