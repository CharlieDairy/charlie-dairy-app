import { prisma } from "@/lib/prisma";
import MilkingForm from "./MilkingForm";

export default async function MilkingEntryPage() {
  const cows = (
    await prisma.cow.findMany({
      where: { status: { in: ["MILKING", "DRY"] } },
      select: { id: true, tag: true },
    })
  ).sort((a, b) => Number(a.tag) - Number(b.tag) || a.tag.localeCompare(b.tag));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900">Milking Entry</h1>
      <MilkingForm cows={cows} />
    </div>
  );
}
