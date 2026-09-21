import { prisma } from "@/lib/prisma";
import InseminationForm from "./InseminationForm";

export default async function InseminationEntryPage() {
  const cows = (
    await prisma.cow.findMany({
      where: { gender: "FEMALE", status: { notIn: ["SOLD", "DEAD"] } },
      select: { id: true, tag: true },
    })
  ).sort((a, b) => Number(a.tag) - Number(b.tag) || a.tag.localeCompare(b.tag));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900">Insemination / Service Entry</h1>
      <InseminationForm cows={cows} />
    </div>
  );
}
