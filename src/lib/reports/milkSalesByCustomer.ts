import { prisma } from "@/lib/prisma";

export type CustomerSalesSummary = {
  buyer: string;
  totalLitres: number;
  totalSaleAmount: number;
  totalPaid: number;
  outstandingBalance: number;
  saleCount: number;
  lastSaleDate: Date | null;
  avgRate: number | null;
};

export async function getCustomerSalesSummary(): Promise<CustomerSalesSummary[]> {
  const [sales, pricedSales, payments] = await Promise.all([
    prisma.milkSale.groupBy({
      by: ["buyer"],
      _sum: { litres: true, amount: true },
      _count: { _all: true },
      _max: { date: true },
    }),
    // Avg rate must come from the SAME subset of rows for both amount and
    // litres. Some backfilled historical rows have real revenue but
    // litres=0 (quantity was never recorded in the original cash ledger —
    // see scripts/deploy/backfill-milksale-from-cash.ts). Dividing total
    // revenue (all rows) by total litres (only the quantity-known rows)
    // produces a nonsensical rate — caught in browser verification before
    // this shipped (an "Avg Rate: Rs 2816/L" for milk is obviously wrong).
    prisma.milkSale.groupBy({
      by: ["buyer"],
      where: { litres: { gt: 0 } },
      _sum: { litres: true, amount: true },
    }),
    prisma.customerPayment.groupBy({
      by: ["buyer"],
      _sum: { amount: true },
    }),
  ]);

  const paidMap = new Map(payments.map((p) => [p.buyer, p._sum.amount ?? 0]));
  const pricedMap = new Map(pricedSales.map((p) => [p.buyer, { litres: p._sum.litres ?? 0, amount: p._sum.amount ?? 0 }]));

  return sales
    .map((s) => {
      const totalLitres = s._sum.litres ?? 0;
      const totalSaleAmount = s._sum.amount ?? 0;
      const totalPaid = paidMap.get(s.buyer) ?? 0;
      const priced = pricedMap.get(s.buyer);
      return {
        buyer: s.buyer,
        totalLitres,
        totalSaleAmount,
        totalPaid,
        outstandingBalance: totalSaleAmount - totalPaid,
        saleCount: s._count._all,
        lastSaleDate: s._max.date,
        avgRate: priced && priced.litres > 0 ? priced.amount / priced.litres : null,
      };
    })
    .sort((a, b) => b.outstandingBalance - a.outstandingBalance);
}

export type CustomerSaleRow = {
  id: string;
  date: Date;
  litres: number;
  rate: number | null;
  amount: number;
};

export type CustomerPaymentRow = {
  id: string;
  date: Date;
  amount: number;
  mode: string;
  notes: string | null;
};

export async function getCustomerDetail(buyer: string): Promise<{ sales: CustomerSaleRow[]; payments: CustomerPaymentRow[] }> {
  const [sales, payments] = await Promise.all([
    prisma.milkSale.findMany({
      where: { buyer },
      orderBy: { date: "desc" },
      select: { id: true, date: true, litres: true, rate: true, amount: true },
    }),
    prisma.customerPayment.findMany({
      where: { buyer },
      orderBy: { date: "desc" },
      select: { id: true, date: true, amount: true, mode: true, notes: true },
    }),
  ]);
  return { sales, payments };
}

export async function getDistinctBuyers(): Promise<string[]> {
  const rows = await prisma.milkSale.findMany({ select: { buyer: true }, distinct: ["buyer"], orderBy: { buyer: "asc" } });
  return rows.map((r) => r.buyer);
}
