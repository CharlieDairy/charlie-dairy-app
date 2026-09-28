import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EditCustomerForm from "./EditCustomerForm";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Edit Customer</h1>
        <Link href="/admin/customers" className="text-sm text-neutral-500 underline">
          ← Back to Customers
        </Link>
      </div>
      <EditCustomerForm customer={customer} />
    </div>
  );
}
