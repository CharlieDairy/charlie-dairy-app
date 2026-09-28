import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatRs } from "@/lib/format";
import AddCustomerForm from "./AddCustomerForm";

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Customer Master</h1>
      <p className="text-sm text-neutral-500 max-w-2xl">
        Milk buyers with their contact details, payment terms and agreed rate. Matched by name against Milk Sale
        Entry&apos;s buyer field — the agreed rate auto-fills there when it recognizes a customer.
      </p>
      <AddCustomerForm />
      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Customer</th>
              <th className="text-left px-3 py-2">Phone</th>
              <th className="text-left px-3 py-2">Payment Terms</th>
              <th className="text-right px-3 py-2">Agreed Rate</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-t border-neutral-100">
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2">{c.phone ?? "—"}</td>
                <td className="px-3 py-2">{c.paymentTerms ?? "—"}</td>
                <td className="px-3 py-2 text-right">{c.agreedRate !== null ? `${formatRs(c.agreedRate)}/L` : "—"}</td>
                <td className="px-3 py-2">{c.active ? "Active" : "Hidden"}</td>
                <td className="px-3 py-2">
                  <Link href={`/admin/customers/${c.id}`} className="text-xs rounded px-2 py-1 border border-neutral-300 text-neutral-700 hover:bg-neutral-100">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-neutral-500">No customers added yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
