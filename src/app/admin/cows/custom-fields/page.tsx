import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import AddCustomFieldForm from "./AddCustomFieldForm";
import CustomFieldActiveToggle from "./CustomFieldActiveToggle";

const TYPE_LABELS: Record<string, string> = { TEXT: "Text", NUMBER: "Number", DATE: "Date" };

export default async function CustomFieldsPage() {
  const defs = await prisma.cowCustomFieldDef.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Custom Fields" />
      <p className="text-base font-semibold text-neutral-600">
        Define extra fields to capture whatever matters to your farm beyond the built-in ones — insurance policy
        number, breed registry ID, microchip number, anything. Once added, every field shows up on each cow&apos;s
        profile page to fill in. Hiding a field keeps its past values but stops it showing on profiles going forward.
      </p>
      <AddCustomFieldForm />
      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Field Name</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {defs.map((d) => (
              <tr key={d.id} className="border-t border-neutral-100">
                <td className="px-3 py-2 font-medium">{d.label}</td>
                <td className="px-3 py-2">{TYPE_LABELS[d.fieldType] ?? d.fieldType}</td>
                <td className="px-3 py-2">{d.active ? "Active" : "Hidden"}</td>
                <td className="px-3 py-2">
                  <CustomFieldActiveToggle id={d.id} active={d.active} />
                </td>
              </tr>
            ))}
            {defs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-neutral-500">No custom fields defined yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
