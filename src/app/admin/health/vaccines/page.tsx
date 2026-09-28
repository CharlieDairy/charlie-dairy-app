import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import AddVaccineForm from "./AddVaccineForm";
import VaccineActiveToggle from "./VaccineActiveToggle";

export default async function VaccinesPage() {
  const vaccines = await prisma.vaccineDef.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Vaccines" />
      <p className="text-sm text-neutral-500 max-w-2xl">
        The vaccine catalog used by Vaccination Entry. Set a repeat interval to have the next due date calculated
        automatically when a vaccination is recorded.
      </p>
      <AddVaccineForm />
      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Vaccine</th>
              <th className="text-left px-3 py-2">Repeat Every</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vaccines.map((v) => (
              <tr key={v.id} className="border-t border-neutral-100">
                <td className="px-3 py-2 font-medium">{v.name}</td>
                <td className="px-3 py-2">{v.repeatIntervalDays ? `${v.repeatIntervalDays} days` : "—"}</td>
                <td className="px-3 py-2">{v.active ? "Active" : "Hidden"}</td>
                <td className="px-3 py-2">
                  <VaccineActiveToggle id={v.id} active={v.active} />
                </td>
              </tr>
            ))}
            {vaccines.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-neutral-500">No vaccines defined yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
