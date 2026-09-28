import { prisma } from "@/lib/prisma";
import { getHerdOverview } from "@/lib/reports/herdOverview";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import AddCowForm from "./AddCowForm";
import CowsTable from "./CowsTable";

export default async function CowsAdminPage() {
  const overview = await getHerdOverview();
  const cows = (await prisma.cow.findMany()).sort((a, b) => Number(a.tag) - Number(b.tag) || a.tag.localeCompare(b.tag));
  const statusItems = await prisma.masterDataItem.findMany({ where: { category: "COW_STATUS" }, orderBy: { sortOrder: "asc" } });
  // Include hidden statuses too, so a cow currently on a since-hidden status still shows correctly in its own dropdown.
  const allStatusOptions = statusItems.map((s) => ({ code: s.code, label: s.label }));
  const activeStatusOptions = statusItems.filter((s) => s.active).map((s) => ({ code: s.code, label: s.label }));

  const rows = cows.map((c) => ({
    id: c.id,
    tag: c.tag,
    breed: c.breed,
    gender: c.gender,
    status: c.status,
    dateOfBirth: c.dateOfBirth ? c.dateOfBirth.toISOString() : null,
    lactationNumber: c.lactationNumber,
    photoUrl: c.photoUrl,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Cow Register" />
      <div className="grid grid-cols-3 gap-4 max-w-2xl">
        <StatCard label="Total Animals" value={overview.totalAnimals.toString()} />
        <StatCard label="Active Herd" value={overview.activeHerdSize.toString()} />
        <StatCard label="Milking Now" value={overview.milkingNow.toString()} />
      </div>
      <AddCowForm statusOptions={activeStatusOptions} />
      <CowsTable cows={rows} statusOptions={allStatusOptions} />
    </div>
  );
}
