import { prisma } from "@/lib/prisma";
import { compare, monthRanges, type Comparison } from "@/lib/compare";

export type InventoryItemBalance = {
  itemId: string;
  name: string;
  unit: string;
  category: string | null;
  reorderLevel: number | null;
  balance: number;
  costThisMonth: number;
  lowStock: boolean;
};

export type InventoryOverview = {
  items: InventoryItemBalance[];
  lowStockCount: number;
  quantityOut: Comparison;
  costOut: Comparison;
};

// Same ledger pattern as Feed (src/lib/reports/feed.ts): balance is a
// running IN-minus-OUT per item, derived from InventoryTransaction rather
// than a stored counter, so it can never drift from the entry history.
// Unlike Feed, items come from a catalog (InventoryItem) so each can carry
// an optional reorder level -- that's what makes a low-stock alert possible.
export async function getInventoryOverview(referenceDate = new Date()): Promise<InventoryOverview> {
  const { currentStart, nextStart, previousStart } = monthRanges(referenceDate);

  const [items, allTx, currentMonthOut, previousMonthOut, costByItemThisMonth] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.inventoryTransaction.findMany({ select: { itemId: true, direction: true, quantity: true } }),
    prisma.inventoryTransaction.aggregate({
      where: { direction: "OUT", date: { gte: currentStart, lt: nextStart } },
      _sum: { quantity: true, cost: true },
    }),
    prisma.inventoryTransaction.aggregate({
      where: { direction: "OUT", date: { gte: previousStart, lt: currentStart } },
      _sum: { quantity: true, cost: true },
    }),
    prisma.inventoryTransaction.groupBy({
      by: ["itemId"],
      where: { direction: "OUT", date: { gte: currentStart, lt: nextStart } },
      _sum: { cost: true },
    }),
  ]);

  const costMap = new Map(costByItemThisMonth.map((c) => [c.itemId, c._sum.cost ?? 0]));
  const balanceMap = new Map<string, number>();
  for (const tx of allTx) {
    const delta = tx.direction === "IN" ? tx.quantity : -tx.quantity;
    balanceMap.set(tx.itemId, (balanceMap.get(tx.itemId) ?? 0) + delta);
  }

  const balances: InventoryItemBalance[] = items.map((item) => {
    const balance = balanceMap.get(item.id) ?? 0;
    return {
      itemId: item.id,
      name: item.name,
      unit: item.unit,
      category: item.category,
      reorderLevel: item.reorderLevel,
      balance,
      costThisMonth: costMap.get(item.id) ?? 0,
      lowStock: item.reorderLevel !== null && balance <= item.reorderLevel,
    };
  });

  return {
    items: balances,
    lowStockCount: balances.filter((b) => b.lowStock).length,
    quantityOut: compare(currentMonthOut._sum.quantity ?? 0, previousMonthOut._sum.quantity ?? 0),
    costOut: compare(currentMonthOut._sum.cost ?? 0, previousMonthOut._sum.cost ?? 0),
  };
}
