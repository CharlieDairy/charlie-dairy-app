import { prisma } from "@/lib/prisma";
import AddCowForm from "./AddCowForm";
import StatusSelect from "./StatusSelect";

export default async function CowsAdminPage() {
  const cows = (await prisma.cow.findMany()).sort((a, b) => Number(a.tag) - Number(b.tag) || a.tag.localeCompare(b.tag));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Cow Register</h1>
      <AddCowForm />
      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Tag</th>
              <th className="text-left px-3 py-2">Gender</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Condition</th>
              <th className="text-left px-3 py-2">Last Calving</th>
              <th className="text-right px-3 py-2">Lactation #</th>
              <th className="text-left px-3 py-2">Expected Calving</th>
              <th className="text-left px-3 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {cows.map((c) => (
              <tr key={c.id} className="border-t border-neutral-100">
                <td className="px-3 py-2 font-medium">{c.tag}</td>
                <td className="px-3 py-2">{c.gender}</td>
                <td className="px-3 py-2"><StatusSelect cowId={c.id} status={c.status} /></td>
                <td className="px-3 py-2">{c.condition ?? "—"}</td>
                <td className="px-3 py-2">{c.lastCalvingDate ? c.lastCalvingDate.toISOString().slice(0, 10) : "—"}</td>
                <td className="px-3 py-2 text-right">{c.lactationNumber}</td>
                <td className="px-3 py-2">{c.expectedCalving ? c.expectedCalving.toISOString().slice(0, 10) : "—"}</td>
                <td className="px-3 py-2">{c.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
