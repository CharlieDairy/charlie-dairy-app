import { prisma } from "@/lib/prisma";
import VaccinationForm from "./VaccinationForm";

export default async function VaccinationEntryPage() {
  const [cows, vaccines] = await Promise.all([
    prisma.cow.findMany({ where: { status: { notIn: ["SOLD", "DEAD"] } }, select: { id: true, tag: true }, orderBy: { tag: "asc" } }),
    prisma.vaccineDef.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  const sortedCows = cows.sort((a, b) => Number(a.tag) - Number(b.tag) || a.tag.localeCompare(b.tag));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Vaccination Entry</h1>
      <VaccinationForm cows={sortedCows} vaccineNames={vaccines.map((v) => v.name)} />
    </div>
  );
}
