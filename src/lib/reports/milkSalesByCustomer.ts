import { prisma } from "@/lib/prisma";
import { periodRange, type PeriodKey } from "./herd";

// Sales loaded from history (see scripts/deploy/backfill-milksale-from-cash.ts
// and the 12-month history load) carry this marker. They are real litres and
// rupees for reports by period, but the money was already received and
// booked through the cash ledger, so they must never count as an unpaid
// customer bill: balances, statements and AR aging skip them.
const BACKFILL_MARKER = "Backfill (cash ledger)";
// `NOT: { enteredBy: marker }` would also drop rows whose enteredBy is NULL
// (SQL three-valued logic), so spell it out.
const REAL_BILLING = { OR: [{ enteredBy: null }, { enteredBy: { not: BACKFILL_MARKER } }] };

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

export async function getCustomerSalesSummary(period: PeriodKey = "month", from?: string, to?: string): Promise<CustomerSalesSummary[]> {
  const range = periodRange(period, new Date(), from, to);
  const dateFilter = { gte: range.start, lt: range.end };

  const [periodSales, pricedSales, lifetimeSales, payments] = await Promise.all([
    prisma.milkSale.groupBy({
      by: ["buyer"],
      where: { date: dateFilter },
      _sum: { litres: true, amount: true },
      _count: { _all: true },
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
      where: { litres: { gt: 0 }, date: dateFilter },
      _sum: { litres: true, amount: true },
    }),
    // Always the FULL lifetime list, never date-filtered -- outstandingBalance
    // is a lifetime debt figure, not "owed for this period" (matches Channab:
    // its Balance column doesn't move when you switch the period filter).
    // Previously this was only fetched when a period filter was active, and
    // the returned rows were built by mapping over the PERIOD-scoped `sales`
    // query above -- so a buyer with a real lifetime balance but no sale
    // inside the selected period (e.g. "This Month" when their last sale was
    // last month) vanished from the result entirely instead of showing their
    // real balance. The union below fixes that.
    prisma.milkSale.groupBy({ by: ["buyer"], where: REAL_BILLING, _sum: { amount: true }, _max: { date: true } }),
    prisma.customerPayment.groupBy({
      by: ["buyer"],
      _sum: { amount: true },
    }),
  ]);

  const periodMap = new Map(periodSales.map((s) => [s.buyer, s]));
  const pricedMap = new Map(pricedSales.map((p) => [p.buyer, { litres: p._sum.litres ?? 0, amount: p._sum.amount ?? 0 }]));
  const lifetimeMap = new Map(lifetimeSales.map((s) => [s.buyer, s]));
  const paidMap = new Map(payments.map((p) => [p.buyer, p._sum.amount ?? 0]));

  // Union of every buyer with a lifetime sale or a payment on file -- a
  // buyer with zero sales in the selected period but a real lifetime
  // balance must still appear, not just buyers active within the period.
  const allBuyers = new Set<string>([...lifetimeMap.keys(), ...paidMap.keys()]);

  return Array.from(allBuyers)
    .map((buyer) => {
      const period = periodMap.get(buyer);
      const lifetime = lifetimeMap.get(buyer);
      const priced = pricedMap.get(buyer);
      const totalPaid = paidMap.get(buyer) ?? 0;
      const lifetimeAmount = lifetime?._sum.amount ?? 0;
      return {
        buyer,
        totalLitres: period?._sum.litres ?? 0,
        totalSaleAmount: period?._sum.amount ?? 0,
        totalPaid,
        outstandingBalance: lifetimeAmount - totalPaid,
        saleCount: period?._count._all ?? 0,
        lastSaleDate: lifetime?._max.date ?? null,
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
      where: { buyer, ...REAL_BILLING },
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

export type CustomerWithSales = {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
  totalLitres: number;
  totalSaleAmount: number;
  outstandingBalance: number;
};

// Joins Customer master records with their sales summary, by name -- the
// same free-text-key match used everywhere else a Customer/FeedItem is
// matched against a string field. Includes customers with zero sales
// (a new customer added before their first sale is still a customer).
export type ArAgingRow = {
  buyer: string;
  current: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  total: number;
};

// Sales/payments aren't matched invoice-to-invoice (a payment is a lump sum
// against a buyer, not tied to a specific sale) -- so aging is computed by
// FIFO-consuming each buyer's lifetime payments against their oldest unpaid
// sales first, the standard approach when there's no explicit invoice
// matching. Whatever amount is left unconsumed per sale ages from that
// sale's own date.
export async function getArAging(asOf: Date = new Date()): Promise<ArAgingRow[]> {
  const [sales, payments] = await Promise.all([
    prisma.milkSale.findMany({ where: REAL_BILLING, orderBy: { date: "asc" }, select: { buyer: true, date: true, amount: true } }),
    prisma.customerPayment.groupBy({ by: ["buyer"], _sum: { amount: true } }),
  ]);

  const salesByBuyer = new Map<string, { date: Date; remaining: number }[]>();
  for (const s of sales) {
    if (!salesByBuyer.has(s.buyer)) salesByBuyer.set(s.buyer, []);
    salesByBuyer.get(s.buyer)!.push({ date: s.date, remaining: s.amount });
  }
  const paidByBuyer = new Map(payments.map((p) => [p.buyer, p._sum.amount ?? 0]));

  const rows: ArAgingRow[] = [];
  for (const [buyer, saleList] of salesByBuyer) {
    let paymentPool = paidByBuyer.get(buyer) ?? 0;
    for (const s of saleList) {
      if (paymentPool <= 0) break;
      const consume = Math.min(paymentPool, s.remaining);
      s.remaining -= consume;
      paymentPool -= consume;
    }

    const bucket = { current: 0, days31to60: 0, days61to90: 0, over90: 0 };
    for (const s of saleList) {
      if (s.remaining <= 0.01) continue;
      const ageDays = Math.floor((asOf.getTime() - s.date.getTime()) / 86_400_000);
      if (ageDays <= 30) bucket.current += s.remaining;
      else if (ageDays <= 60) bucket.days31to60 += s.remaining;
      else if (ageDays <= 90) bucket.days61to90 += s.remaining;
      else bucket.over90 += s.remaining;
    }
    const total = bucket.current + bucket.days31to60 + bucket.days61to90 + bucket.over90;
    if (total > 0.01) rows.push({ buyer, ...bucket, total });
  }

  return rows.sort((a, b) => b.total - a.total);
}

export async function getCustomersWithSales(period: PeriodKey = "month", from?: string, to?: string): Promise<CustomerWithSales[]> {
  const [customers, sales] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    getCustomerSalesSummary(period, from, to),
  ]);
  const salesMap = new Map(sales.map((s) => [s.buyer.toLowerCase(), s]));

  return customers.map((c) => {
    const s = salesMap.get(c.name.toLowerCase());
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      active: c.active,
      totalLitres: s?.totalLitres ?? 0,
      totalSaleAmount: s?.totalSaleAmount ?? 0,
      outstandingBalance: s?.outstandingBalance ?? 0,
    };
  });
}
