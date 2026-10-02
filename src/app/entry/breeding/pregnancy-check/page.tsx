import { prisma } from "@/lib/prisma";
import PregnancyCheckForm from "./PregnancyCheckForm";

export default async function PregnancyCheckEntryPage() {
  const cows = (
    await prisma.cow.findMany({
      where: { gender: "FEMALE", status: { notIn: ["SOLD", "DEAD"] } },
      select: { id: true, tag: true },
    })
  ).sort((a, b) => Number(a.tag) - Number(b.tag) || a.tag.localeCompare(b.tag));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Pregnancy Check Entry</h1>
      <PregnancyCheckForm cows={cows} />
    </div>
  );
}
