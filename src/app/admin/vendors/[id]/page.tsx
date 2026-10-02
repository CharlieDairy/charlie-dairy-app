import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatRs } from "@/lib/format";
import { getVendorTransactions } from "@/lib/reports/vendorLedger";
import EditVendorForm from "./EditVendorForm";

function fmtDate(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vendor = await prisma.vendor.findUnique({ where: { id } });
  if (!vendor) notFound();

  const transactions = await getVendorTransactions(vendor.name);
  const totalSpent = transactions.reduce((n, t) => n + t.amountOut, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">{vendor.name}</h1>
        <Link href="/admin/vendors" className="link-btn">
          ← Back to Vendor Ledger
        </Link>
      </div>

      <EditVendorForm vendor={vendor} />

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-neutral-900">Transaction History</h2>
          <span className="text-sm text-neutral-500">Total spent: <span className="font-semibold text-neutral-900">{formatRs(totalSpent)}</span></span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-neutral-500">
              <th className="text-left py-1 font-normal">Date</th>
              <th className="text-left py-1 font-normal">Category</th>
              <th className="text-left py-1 font-normal">Mode</th>
              <th className="text-left py-1 font-normal">Remark</th>
              <th className="text-right py-1 font-normal">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-t border-neutral-100">
                <td className="py-1">{fmtDate(t.date)}</td>
                <td className="py-1">{t.category}</td>
                <td className="py-1">{t.mode}</td>
                <td className="py-1 text-neutral-500">{t.remark ?? "—"}</td>
                <td className="py-1 text-right">{formatRs(t.amountOut)}</td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-neutral-400">
                  No cash transactions recorded for this vendor name yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
