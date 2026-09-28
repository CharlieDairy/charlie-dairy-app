import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import AddMedicineForm from "./AddMedicineForm";
import MedicineActiveToggle from "./MedicineActiveToggle";

export default async function MedicinesPage() {
  const medicines = await prisma.medicineDef.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Medicines" />
      <p className="text-sm text-neutral-500 max-w-2xl">
        The medicine catalog used by Treatment Entry.
      </p>
      <AddMedicineForm />
      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Medicine</th>
              <th className="text-left px-3 py-2">Unit</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {medicines.map((m) => (
              <tr key={m.id} className="border-t border-neutral-100">
                <td className="px-3 py-2 font-medium">{m.name}</td>
                <td className="px-3 py-2">{m.unit ?? "—"}</td>
                <td className="px-3 py-2">{m.active ? "Active" : "Hidden"}</td>
                <td className="px-3 py-2">
                  <MedicineActiveToggle id={m.id} active={m.active} />
                </td>
              </tr>
            ))}
            {medicines.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-neutral-500">No medicines defined yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
