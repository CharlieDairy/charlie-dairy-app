import { prisma } from "@/lib/prisma";
import { periodRange, type PeriodKey } from "./herd";

export type VendorSpendSummary = {
  vendor: string;
  totalSpent: number;
  txnCount: number;
  lastTxnDate: Date | null;
};

// Matched by CashTransaction.party against Vendor.name (free-text key, same
// convention as Customer/MilkSale.buyer) -- so a vendor's spend history
// exists the moment a matching party name appears in the cash ledger,
// nothing needs to be re-entered.
export async function getVendorSpendSummary(period: PeriodKey = "month", from?: string, to?: string): Promise<VendorSpendSummary[]> {
  const range = periodRange(period, new Date(), from, to);
  const rows = await prisma.cashTransaction.groupBy({
    by: ["party"],
    where: {
      amountOut: { gt: 0 },
      party: { not: null },
      date: { gte: range.start, lt: range.end },
    },
    _sum: { amountOut: true },
    _count: { _all: true },
    _max: { date: true },
  });

  return rows
    .filter((r): r is typeof r & { party: string } => !!r.party)
    .map((r) => ({
      vendor: r.party,
      totalSpent: r._sum.amountOut ?? 0,
      txnCount: r._count._all,
      lastTxnDate: r._max.date,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent);
}

export type VendorWithSpend = {
  id: string;
  name: string;
  phone: string | null;
  category: string | null;
  active: boolean;
  totalSpent: number;
  txnCount: number;
  lastTxnDate: Date | null;
};

export async function getVendorsWithSpend(period: PeriodKey = "month", from?: string, to?: string): Promise<VendorWithSpend[]> {
  const [vendors, spend] = await Promise.all([
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
    getVendorSpendSummary(period, from, to),
  ]);
  const spendMap = new Map(spend.map((s) => [s.vendor.toLowerCase(), s]));

  return vendors.map((v) => {
    const s = spendMap.get(v.name.toLowerCase());
    return {
      id: v.id,
      name: v.name,
      phone: v.phone,
      category: v.category,
      active: v.active,
      totalSpent: s?.totalSpent ?? 0,
      txnCount: s?.txnCount ?? 0,
      lastTxnDate: s?.lastTxnDate ?? null,
    };
  });
}

export type VendorTxnRow = {
  id: string;
  date: Date;
  category: string;
  mode: string;
  amountOut: number;
  remark: string | null;
};

export async function getVendorTransactions(name: string): Promise<VendorTxnRow[]> {
  return prisma.cashTransaction.findMany({
    where: { party: { equals: name, mode: "insensitive" }, amountOut: { gt: 0 } },
    orderBy: { date: "desc" },
    select: { id: true, date: true, category: true, mode: true, amountOut: true, remark: true },
  });
}
