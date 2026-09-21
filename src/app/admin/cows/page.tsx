import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import AddCowForm from "./AddCowForm";
import CowsTable from "./CowsTable";

export default async function CowsAdminPage() {
  const cows = (await prisma.cow.findMany()).sort((a, b) => Number(a.tag) - Number(b.tag) || a.tag.localeCompare(b.tag));
  const statusItems = await prisma.masterDataItem.findMany({ where: { category: "COW_STATUS" }, orderBy: { sortOrder: "asc" } });
  // Include hidden statuses too, so a cow currently on a since-hidden status still shows correctly in its own dropdown.
  const allStatusOptions = statusItems.map((s) => ({ code: s.code, label: s.label }));
  const activeStatusOptions = statusItems.filter((s) => s.active).map((s) => ({ code: s.code, label: s.label }));

  const rows = cows.map((c) => ({
    id: c.id,
    tag: c.tag,
    gender: c.gender,
    status: c.status,
    dateOfBirth: c.dateOfBirth ? c.dateOfBirth.toISOString() : null,
    lactationNumber: c.lactationNumber,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Cow Register" />
      <AddCowForm statusOptions={activeStatusOptions} />
      <CowsTable cows={rows} statusOptions={allStatusOptions} />
    </div>
  );
}
