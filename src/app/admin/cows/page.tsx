import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AddCowForm from "./AddCowForm";
import StatusSelect from "./StatusSelect";
import DeleteCowButton from "./DeleteCowButton";

function ageFromDob(dob: Date | null): string {
  if (!dob) return "—";
  const ms = Date.now() - dob.getTime();
  const years = ms / (365.25 * 86_400_000);
  if (years < 1) return `${Math.floor(years * 12)} mo`;
  return `${years.toFixed(1)} yr`;
}

export default async function CowsAdminPage() {
  const cows = (await prisma.cow.findMany()).sort((a, b) => Number(a.tag) - Number(b.tag) || a.tag.localeCompare(b.tag));
  const statusItems = await prisma.masterDataItem.findMany({ where: { category: "COW_STATUS" }, orderBy: { sortOrder: "asc" } });
  // Include hidden statuses too, so a cow currently on a since-hidden status still shows correctly in its own dropdown.
  const allStatusOptions = statusItems.map((s) => ({ code: s.code, label: s.label }));
  const activeStatusOptions = statusItems.filter((s) => s.active).map((s) => ({ code: s.code, label: s.label }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Cow Register</h1>
      <AddCowForm statusOptions={activeStatusOptions} />
      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Tag</th>
              <th className="text-left px-3 py-2">Gender</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Date of Birth</th>
              <th className="text-left px-3 py-2">Age</th>
              <th className="text-right px-3 py-2">Lactation #</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cows.map((c) => (
              <tr key={c.id} className="border-t border-neutral-100 align-top">
                <td className="px-3 py-2 font-medium">
                  <Link href={`/admin/cows/${c.id}`} className="text-green-700 hover:underline">
                    {c.tag}
                  </Link>
                </td>
                <td className="px-3 py-2">{c.gender}</td>
                <td className="px-3 py-2"><StatusSelect cowId={c.id} status={c.status} options={allStatusOptions} /></td>
                <td className="px-3 py-2">{c.dateOfBirth ? c.dateOfBirth.toISOString().slice(0, 10) : "—"}</td>
                <td className="px-3 py-2">{ageFromDob(c.dateOfBirth)}</td>
                <td className="px-3 py-2 text-right">{c.lactationNumber}</td>
                <td className="px-3 py-2">
                  <div className="flex items-start gap-2">
                    <Link href={`/admin/cows/${c.id}`} className="text-xs rounded px-2 py-1 border border-neutral-300 text-neutral-700 hover:bg-neutral-100">
                      View
                    </Link>
                    <DeleteCowButton cowId={c.id} tag={c.tag} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
