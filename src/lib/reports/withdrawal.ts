import { prisma } from "@/lib/prisma";

export type ActiveWithdrawal = {
  cowId: string;
  cowTag: string;
  medicineName: string;
  treatedDate: Date;
  withdrawalUntil: Date;
};

// Cows currently within a medicine's milk withdrawal period. MilkSale has no
// cowId (milk is pooled before sale -- see src/app/entry/milk-sale/actions.ts),
// so this can't flag a specific sale as contaminated; it's a farm-wide list
// shown at Milk Sale Entry so whoever's selling can verify that milk was
// excluded. If a cow has multiple overlapping treatments, only the one with
// the latest withdrawalUntil is returned for that cow.
export async function getActiveWithdrawals(referenceDate = new Date()): Promise<ActiveWithdrawal[]> {
  const rows = await prisma.treatmentRecord.findMany({
    where: { withdrawalUntil: { gte: referenceDate } },
    include: { cow: { select: { id: true, tag: true } } },
    orderBy: { withdrawalUntil: "desc" },
  });

  const byCow = new Map<string, ActiveWithdrawal>();
  for (const r of rows) {
    if (!r.withdrawalUntil) continue;
    if (byCow.has(r.cow.id)) continue; // already have this cow's latest (rows are desc by withdrawalUntil)
    byCow.set(r.cow.id, {
      cowId: r.cow.id,
      cowTag: r.cow.tag,
      medicineName: r.medicineName,
      treatedDate: r.date,
      withdrawalUntil: r.withdrawalUntil,
    });
  }

  return Array.from(byCow.values()).sort((a, b) => a.cowTag.localeCompare(b.cowTag, undefined, { numeric: true }));
}
