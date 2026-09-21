import { prisma } from "@/lib/prisma";
import MilkSaleForm from "./MilkSaleForm";

export default async function MilkSaleEntryPage() {
  const rows = await prisma.milkSale.findMany({
    select: { buyer: true },
    distinct: ["buyer"],
    orderBy: { buyer: "asc" },
  });
  const buyers = rows.map((r) => r.buyer);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900">Milk Sale Entry</h1>
      <MilkSaleForm buyers={buyers} />
    </div>
  );
}
