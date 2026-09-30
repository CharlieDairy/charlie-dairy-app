import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import AddMedicineForm from "./AddMedicineForm";
import MedicineRow from "./MedicineRow";

export default async function MedicinesPage() {
  const medicines = await prisma.medicineDef.findMany({ orderBy: { name: "asc" } });
  const missingWithdrawal = medicines.filter((m) => m.active && m.withdrawalDays == null).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader title="Medicines" />
        <Link href="/admin/health/medicines/stock" className="text-sm text-primary underline">Medicine Stock →</Link>
      </div>
      <p className="text-sm text-neutral-500 max-w-2xl">
        The medicine catalog used by Treatment Entry. Set Milk Withdrawal Days per medicine to flag cows at Milk
        Sale Entry while their milk is still within the withdrawal period.
      </p>
      {missingWithdrawal > 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          {missingWithdrawal} active medicine{missingWithdrawal === 1 ? "" : "s"} {missingWithdrawal === 1 ? "has" : "have"} no withdrawal
          days set — treatments with {missingWithdrawal === 1 ? "it" : "them"} won&apos;t trigger a withdrawal warning.
        </p>
      )}
      <AddMedicineForm />
      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Medicine</th>
              <th className="text-left px-3 py-2">Unit</th>
              <th className="text-left px-3 py-2">Milk Withdrawal</th>
              <th className="text-left px-3 py-2">Reorder Level</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {medicines.map((m) => (
              <MedicineRow key={m.id} medicine={m} />
            ))}
            {medicines.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-neutral-500">No medicines defined yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
