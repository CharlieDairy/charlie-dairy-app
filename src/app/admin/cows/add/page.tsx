import { prisma } from "@/lib/prisma";
import AddAnimalForm from "./AddAnimalForm";

export default async function AddAnimalPage() {
  const [statusItems, locationRows, damCows] = await Promise.all([
    prisma.masterDataItem.findMany({ where: { category: "COW_STATUS", active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.cowMovement.findMany({ select: { location: true }, distinct: ["location"], orderBy: { location: "asc" } }),
    prisma.cow.findMany({ where: { gender: "FEMALE" }, select: { tag: true }, orderBy: { tag: "asc" } }),
  ]);
  const statusOptions = statusItems.map((s) => ({ code: s.code, label: s.label }));
  const locations = locationRows.map((r) => r.location);
  const damTags = damCows.map((c) => c.tag);

  return (
    <div className="max-w-3xl">
      <AddAnimalForm statusOptions={statusOptions} locations={locations} damTags={damTags} />
    </div>
  );
}
