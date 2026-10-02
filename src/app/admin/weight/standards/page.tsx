import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import AddStandardForm from "./AddStandardForm";
import DeleteStandardButton from "./DeleteStandardButton";

export default async function WeightStandardsPage() {
  const standards = await prisma.weightStandard.findMany({ orderBy: [{ breed: "asc" }, { ageMonths: "asc" }] });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Weight Standards" />
      <p className="text-base font-semibold text-neutral-600">
        Target weight ranges by age (optionally per breed). The Weight Dashboard uses these to flag an animal as
        under, on-target, or over for its age — leave breed blank for a standard that applies to every breed.
      </p>
      <AddStandardForm />
      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Breed</th>
              <th className="text-right px-3 py-2">Age (months)</th>
              <th className="text-right px-3 py-2">Min (kg)</th>
              <th className="text-right px-3 py-2">Max (kg)</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {standards.map((s) => (
              <tr key={s.id} className="border-t border-neutral-100">
                <td className="px-3 py-2 font-medium">{s.breed ?? "Any breed"}</td>
                <td className="px-3 py-2 text-right">{s.ageMonths}</td>
                <td className="px-3 py-2 text-right">{s.minWeightKg}</td>
                <td className="px-3 py-2 text-right">{s.maxWeightKg}</td>
                <td className="px-3 py-2">
                  <DeleteStandardButton id={s.id} />
                </td>
              </tr>
            ))}
            {standards.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-neutral-500">No weight standards defined yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
