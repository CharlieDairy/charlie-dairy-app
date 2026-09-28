import { prisma } from "@/lib/prisma";
import TreatmentForm from "./TreatmentForm";

export default async function TreatmentEntryPage() {
  const [cows, medicines] = await Promise.all([
    prisma.cow.findMany({ where: { status: { notIn: ["SOLD", "DEAD"] } }, select: { id: true, tag: true }, orderBy: { tag: "asc" } }),
    prisma.medicineDef.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  const sortedCows = cows.sort((a, b) => Number(a.tag) - Number(b.tag) || a.tag.localeCompare(b.tag));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900">Treatment Entry</h1>
      <TreatmentForm cows={sortedCows} medicineNames={medicines.map((m) => m.name)} />
    </div>
  );
}
