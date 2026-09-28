import { prisma } from "@/lib/prisma";
import InventoryForm from "./InventoryForm";

export default async function InventoryEntryPage() {
  const items = await prisma.inventoryItem.findMany({
    where: { active: true },
    select: { id: true, name: true, unit: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900">Inventory Entry</h1>
      <InventoryForm items={items} />
    </div>
  );
}
