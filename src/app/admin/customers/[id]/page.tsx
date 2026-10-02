import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { formatRs } from "@/lib/format";
import { getCustomerDetail } from "@/lib/reports/milkSalesByCustomer";
import EditCustomerForm from "./EditCustomerForm";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) notFound();

  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const detail = await getCustomerDetail(customer.name);
  const totalLitres = detail.sales.reduce((n, s) => n + s.litres, 0);
  const totalSaleAmount = detail.sales.reduce((n, s) => n + s.amount, 0);
  const totalPaid = detail.payments.reduce((n, p) => n + p.amount, 0);
  const outstanding = totalSaleAmount - totalPaid;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">{customer.name}</h1>
        <Link href="/admin/customers" className="link-btn">
          ← Back to Customers
        </Link>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <h2 className="font-semibold text-text mb-3">Sales Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><span className="text-neutral-500">Total Litres:</span> {totalLitres.toLocaleString()} L</div>
          <div><span className="text-neutral-500">Total Sales:</span> {formatRs(totalSaleAmount)}</div>
          <div><span className="text-neutral-500">Total Paid:</span> {formatRs(totalPaid)}</div>
          <div>
            <span className="text-neutral-500">Outstanding:</span>{" "}
            <span className={outstanding > 0 ? "text-danger font-medium" : "text-text"}>{formatRs(outstanding)}</span>
          </div>
        </div>
        <Link href={`/admin/reports/milk-sales?buyer=${encodeURIComponent(customer.name)}`} className="link-btn mt-3">
          View full sales & payments ledger →
        </Link>
      </div>

      {isAdmin ? (
        <EditCustomerForm customer={customer} />
      ) : (
        <div className="bg-white border border-neutral-200 rounded-lg p-4 text-sm">
          <p className="text-neutral-500">
            Phone: {customer.phone ?? "—"} · Payment terms: {customer.paymentTerms ?? "—"} · Agreed rate:{" "}
            {customer.agreedRate !== null ? `Rs ${customer.agreedRate.toFixed(2)}/L` : "not set"}
          </p>
          <p className="text-xs text-neutral-400 mt-2">Only an Admin can edit customer details or their agreed rate.</p>
        </div>
      )}
    </div>
  );
}
