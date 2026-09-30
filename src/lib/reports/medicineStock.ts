import { prisma } from "@/lib/prisma";

export type MedicineBalance = {
  medicineDefId: string;
  name: string;
  unit: string | null;
  balance: number;
  avgDailyUse: number; // OUT quantity / day, trailing 30 days
  daysRemaining: number | null;
  reorderLevel: number | null;
  lowStock: boolean;
  withdrawalDays: number | null;
};

export type MedicineStockOverview = {
  balances: MedicineBalance[];
  lowStockCount: number;
};

// Mirrors getFeedOverview (src/lib/reports/feed.ts): a running IN-minus-OUT
// balance per medicine from MedicineStockTransaction, keyed by the real
// medicineDefId FK (medicine already has one, unlike Feed's free-text
// match). OUT rows come from recordTreatment's quantityUsed; IN rows from
// the Restock Medicine form.
export async function getMedicineStockOverview(referenceDate = new Date()): Promise<MedicineStockOverview> {
  const trailing30Start = new Date(referenceDate.getTime() - 30 * 86_400_000);

  const [medicines, allTx, recentOut] = await Promise.all([
    prisma.medicineDef.findMany({
      where: { active: true },
      select: { id: true, name: true, unit: true, reorderLevel: true, withdrawalDays: true },
      orderBy: { name: "asc" },
    }),
    prisma.medicineStockTransaction.findMany({ select: { medicineDefId: true, direction: true, quantity: true } }),
    prisma.medicineStockTransaction.findMany({
      where: { direction: "OUT", date: { gte: trailing30Start, lte: referenceDate } },
      select: { medicineDefId: true, quantity: true },
    }),
  ]);

  const balanceMap = new Map<string, number>();
  for (const tx of allTx) {
    const delta = tx.direction === "IN" ? tx.quantity : -tx.quantity;
    balanceMap.set(tx.medicineDefId, (balanceMap.get(tx.medicineDefId) ?? 0) + delta);
  }
  const recentOutMap = new Map<string, number>();
  for (const tx of recentOut) {
    recentOutMap.set(tx.medicineDefId, (recentOutMap.get(tx.medicineDefId) ?? 0) + tx.quantity);
  }

  const balances: MedicineBalance[] = medicines.map((m) => {
    const balance = balanceMap.get(m.id) ?? 0;
    const avgDailyUse = (recentOutMap.get(m.id) ?? 0) / 30;
    return {
      medicineDefId: m.id,
      name: m.name,
      unit: m.unit,
      balance,
      avgDailyUse,
      daysRemaining: avgDailyUse > 0 ? balance / avgDailyUse : null,
      reorderLevel: m.reorderLevel,
      lowStock: m.reorderLevel !== null && balance <= m.reorderLevel,
      withdrawalDays: m.withdrawalDays,
    };
  });

  return { balances, lowStockCount: balances.filter((b) => b.lowStock).length };
}
