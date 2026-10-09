import { prisma } from "@/lib/prisma";
import { CLASS_LABEL, INCOME_CLASSES, classifyCash, netOf } from "@/lib/accounting/cashClass";
import { cashTotals, dateBounds, farmDateKey, milkSession, periodBounds } from "./dashboardMetrics";

export async function getFarmDashboard(params: { period?: string; from?: string; to?: string }) {
  const today = farmDateKey();
  // "Today" bounds are no longer user-selectable (the standalone DAY picker
  // was removed as a duplicate of the PERIOD selector's own Today option) --
  // still needed internally for genuinely today-specific operational facts
  // (the "milk records pending" alert, feed cost "today", latest-recorded-
  // day lookup) that shouldn't silently become week/month/year totals just
  // because PERIOD is set to something broader.
  const { start, end } = dateBounds(today);
  const range = periodBounds(params.period ?? "month", today, params.from, params.to);
  // Production vs sales chart follows the PERIOD selector (range), which can
  // span further back than today -- widen the milk query's lower bound to
  // cover whichever reaches further, and the upper bound in case a custom
  // period's "to" date is in the future.
  const seriesStart = range.start < start ? range.start : start;
  const seriesEnd = range.end > end ? range.end : end;
  const [cows, milk, sales, payments, cash, feed, vaccinations, treatments, lastMilk] = await Promise.all([
    prisma.cow.findMany({ select: { id: true, tag: true, gender: true, status: true, breed: true, dateOfBirth: true, expectedCalving: true, nextAiDate: true } }),
    prisma.milkingRecord.findMany({ where: { date: { gte: seriesStart, lt: seriesEnd } }, select: { cowId: true, date: true, shift: true, litres: true } }),
    prisma.milkSale.findMany({ where: { date: { lt: dateBounds(today).end } }, select: { date: true, buyer: true, litres: true, amount: true, enteredBy: true } }),
    prisma.customerPayment.findMany({ where: { date: { lt: dateBounds(today).end } }, select: { buyer: true, amount: true } }),
    prisma.cashTransaction.findMany({ select: { date: true, category: true, mode: true, amountIn: true, amountOut: true, remark: true, accountClass: true } }),
    prisma.feedTransaction.findMany({ select: { date: true, feedType: true, direction: true, quantity: true, cost: true } }),
    prisma.vaccinationRecord.findMany({ select: { cowId: true, vaccineName: true, date: true, nextDueDate: true } }),
    prisma.treatmentRecord.findMany({ where: { date: { gte: new Date(dateBounds(today).start.getTime() - 29 * 86400000), lt: dateBounds(today).end } }, select: { cowId: true } }),
    prisma.milkingRecord.findFirst({ where: { date: { lt: end } }, orderBy: { date: "desc" }, select: { date: true } }),
  ]);
  const active = cows.filter(c => ["MILKING", "DRY", "HEIFER", "CALF"].includes(c.status));
  const activeIds = new Set(active.map(c => c.id));
  const expected = active.filter(c => c.status === "MILKING").map(c => c.id);
  const daily = milk.filter(r => r.date >= start && r.date < end);
  const saleDay = sales.filter(s => s.date >= start && s.date < end);
  const dailyMilk = milkSession(daily, expected);
  // The 4 top metric cards (Milk/Sold/Unsold/Avg) follow the PERIOD selector
  // instead of always being exactly today, now that there's no separate DAY
  // picker to anchor them to a specific day.
  const periodMilkRows = milk.filter(r => r.date >= range.start && r.date < range.end);
  const periodSales = sales.filter(s => s.date >= range.start && s.date < range.end);
  const periodMilk = milkSession(periodMilkRows, expected);
  // Production vs sales chart: follows the PERIOD selector (range) instead
  // of a fixed trailing window, so switching Week/Month/Year/custom above
  // actually changes what the chart shows.
  const seriesDays = Math.max(1, Math.min(366, Math.round((range.end.getTime() - range.start.getTime()) / 86400000)));
  const series = Array.from({ length: seriesDays }, (_, i) => {
    const key = new Date(range.start.getTime() + i * 86400000).toISOString().slice(0, 10);
    const m = milk.filter(r => r.date.toISOString().slice(0, 10) === key);
    const s = sales.filter(r => r.date.toISOString().slice(0, 10) === key);
    return { date: key, produced: m.length ? m.reduce((n, r) => n + r.litres, 0) : null, sold: s.length && s.every(r => r.litres > 0) ? s.reduce((n, r) => n + r.litres, 0) : null };
  });
  const inPeriod = (d: Date) => d >= range.start && d < range.end;
  const income: Record<string, number> = {}, expenses: Record<string, number> = {};
  // Cash basis: income is what was RECEIVED (milk, animals, other), costs are what was paid to run the farm.
  // Capital spending, money from / to the partners and the opening balance are not income or cost.
  for (const c of cash.filter(c => inPeriod(c.date))) {
    const cls = classifyCash(c);
    if (INCOME_CLASSES.includes(cls)) income[CLASS_LABEL[cls]] = (income[CLASS_LABEL[cls]] ?? 0) + netOf(cls, c.amountIn, c.amountOut);
    else if (cls === "OPEX") expenses[c.category] = (expenses[c.category] ?? 0) + netOf(cls, c.amountIn, c.amountOut);
  }
  // Historical cash-ledger sales have already been received; never turn them
  // into invented receivables merely because no CustomerPayment exists.
  const billed = new Map<string, number>(), received = new Map<string, number>();
  for (const s of sales.filter(s => s.enteredBy !== "Backfill (cash ledger)" && s.buyer.trim())) billed.set(s.buyer, (billed.get(s.buyer) ?? 0) + s.amount);
  for (const p of payments) received.set(p.buyer, (received.get(p.buyer) ?? 0) + p.amount);
  const receivables = [...billed].map(([buyer, amount]) => ({ buyer, billed: amount, received: received.get(buyer) ?? 0, balance: amount - (received.get(buyer) ?? 0) }));
  const nowStart = dateBounds(today).start;
  const horizon = new Date(nowStart.getTime() + 30 * 86400000);
  const latestVax = new Map<string, typeof vaccinations[number]>();
  for (const v of vaccinations.filter(v => activeIds.has(v.cowId) && v.date < dateBounds(today).end)) {
    const key = `${v.cowId}:${v.vaccineName}`;
    if (!latestVax.has(key) || latestVax.get(key)!.date < v.date) latestVax.set(key, v);
  }
  const vaccinated = new Set([...latestVax.values()].map(v => v.cowId)).size;
  const breeding = active.filter(c => c.gender === "FEMALE" && c.nextAiDate && !c.expectedCalving);
  const ages = ["< 1 year", "1–2 years", "2–3 years", "3–5 years", "5+ years", "Unknown"] .map(label => ({ label, count: 0 }));
  for (const c of active) {
    const years = c.dateOfBirth ? (nowStart.getTime() - c.dateOfBirth.getTime()) / (365.2425 * 86400000) : null;
    ages[years === null || years < 0 ? 5 : years < 1 ? 0 : years < 2 ? 1 : years < 3 ? 2 : years < 5 ? 3 : 4].count++;
  }
  const stock = new Map<string, { type: string; balance: number; consumed: number }>();
  for (const f of feed.filter(f => f.date < dateBounds(today).end)) {
    const row = stock.get(f.feedType) ?? { type: f.feedType, balance: 0, consumed: 0 };
    row.balance += (f.direction === "IN" ? 1 : -1) * f.quantity;
    if (f.direction === "OUT" && f.date >= new Date(nowStart.getTime() - 29 * 86400000)) row.consumed += f.quantity;
    stock.set(f.feedType, row);
  }
  const stocks = [...stock.values()].map(s => ({ ...s, days: s.consumed > 0 ? s.balance / (s.consumed / 30) : null }));
  const lastDate = lastMilk?.date.toISOString().slice(0, 10) ?? null;
  const topRows = lastDate ? await prisma.milkingRecord.groupBy({ by: ["cowId"], where: { date: { gte: dateBounds(lastDate).start, lt: dateBounds(lastDate).end }, cowId: { not: null } }, _sum: { litres: true }, orderBy: { _sum: { litres: "desc" } }, take: 5 }) : [];
  const feedCost = (test: (d: Date) => boolean) => {
    const rows = feed.filter(f => f.direction === "OUT" && test(f.date));
    return { amount: rows.reduce((n, f) => n + (f.cost ?? 0), 0), count: rows.length, missing: rows.filter(f => f.cost === null).length };
  };
  return { today, range, active, cows, expected, dailyMilk, periodMilk, periodSales, morning: milkSession(periodMilkRows.filter(r => r.shift === "MORNING"), expected), evening: milkSession(periodMilkRows.filter(r => r.shift === "EVENING"), expected), saleDay, series, income, expenses, receivables, vaccinated, neverVaccinated: active.length - vaccinated, dueVaccines: [...latestVax.values()].filter(v => v.nextDueDate && v.nextDueDate >= nowStart && v.nextDueDate <= horizon).length, treatments: treatments.filter(t => activeIds.has(t.cowId)).length, breeding, pregnant: active.filter(c => c.expectedCalving).length, calvings: active.filter(c => c.expectedCalving && c.expectedCalving >= nowStart && c.expectedCalving <= horizon).length, overdueCalvings: active.filter(c => c.expectedCalving && c.expectedCalving < nowStart).length, ages, stocks, lastDate, top: topRows.map(r => ({ id: r.cowId!, tag: cows.find(c => c.id === r.cowId)?.tag ?? "Unknown", litres: r._sum.litres ?? 0 })), feedDay: feedCost(d => d >= start && d < end), feedPeriod: feedCost(inPeriod), cash: cashTotals(cash.filter(c => c.date < dateBounds(today).end)), missingQuantities: sales.filter(s => s.litres <= 0).length };
}
