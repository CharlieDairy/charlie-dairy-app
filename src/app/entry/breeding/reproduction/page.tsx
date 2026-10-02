import { prisma } from "@/lib/prisma";
import HeatForm from "../heat/HeatForm";
import InseminationForm from "../ai/InseminationForm";
import PregnancyCheckForm from "../pregnancy-check/PregnancyCheckForm";

export default async function ReproductionEntryPage() {
  const cows = (
    await prisma.cow.findMany({
      where: { gender: "FEMALE", status: { notIn: ["SOLD", "DEAD"] } },
      select: { id: true, tag: true },
    })
  ).sort((a, b) => Number(a.tag) - Number(b.tag) || a.tag.localeCompare(b.tag));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Reproduction Entry</h1>
      <p className="text-sm text-neutral-500 -mt-4">
        Heat, insemination and pregnancy check — recorded on the same cow at different points in her cycle, kept
        on one page so you don&apos;t have to navigate between them.
      </p>

      <div id="heat" className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">Heat Detection</h2>
        <HeatForm cows={cows} />
      </div>

      <div id="ai" className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">Insemination / Service</h2>
        <InseminationForm cows={cows} />
      </div>

      <div id="pregnancy-check" className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">Pregnancy Check</h2>
        <PregnancyCheckForm cows={cows} />
      </div>
    </div>
  );
}
