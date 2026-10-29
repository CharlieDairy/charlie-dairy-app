import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getLiveUser, hasPermission } from "@/lib/access";
import { farmDateKey } from "@/lib/reports/dashboardMetrics";
import { compareTags } from "@/lib/dailySheet";
import DailySheetForm, { type CowRow, type CustomerRow, type FeedRow, type UseRow } from "./DailySheetForm";

// Same order as the paper sheet; anything else follows alphabetically.
const BUYER_ORDER = ["City Sale", "Farm Sale", "Nawaz Khan", "Hafiz Muneeb", "Mehtab", "Abdur Rasheed"];
const FEED_ORDER = ["Wenda", "Silage", "Turi", "Fodder", "Wheat Straw"];
const USE_ROWS = [
  { type: "CALF_USE", label: "Calves" },
  { type: "EMPLOYEE_USE", label: "Farm labour" },
  { type: "FARM_USE", label: "Miscellaneous (farm use)" },
] as const;

const rank = (order: string[], name: string) => {
  const i = order.indexOf(name);
  return i === -1 ? order.length : i;
};
const shown = (n: number | undefined) => (n === undefined ? "" : String(Math.round(n * 1000) / 1000));
const shiftDate = (key: string, days: number) => new Date(Date.parse(`${key}T00:00:00.000Z`) + days * 86_400_000).toISOString().slice(0, 10);

export default async function DailySheetPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await getLiveUser();
  if (!user) return null; // the layout already renders AccountBlocked in this case
  const today = farmDateKey();
  const asked = (await searchParams).date;
  const date = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today && asked >= "2020-01-01" ? asked : today;
  const day = new Date(`${date}T00:00:00.000Z`);

  const [cows, milk, customers, sales, usage, items, stockRows, feedToday, note] = await Promise.all([
    prisma.cow.findMany({
      where: { OR: [{ status: "MILKING" }, { milkingRecords: { some: { date: day } } }] },
      select: { id: true, tag: true },
    }),
    prisma.milkingRecord.findMany({ where: { date: day }, select: { cowId: true, shift: true, litres: true } }),
    prisma.customer.findMany({ where: { active: true, agreedRate: { not: null } }, select: { id: true, name: true, agreedRate: true } }),
    prisma.milkSale.findMany({ where: { date: day }, select: { buyer: true, litres: true } }),
    prisma.milkUsageRecord.findMany({ where: { date: day }, select: { type: true, litres: true } }),
    prisma.feedItem.findMany({ where: { active: true }, select: { id: true, name: true, unit: true } }),
    prisma.feedTransaction.groupBy({ by: ["feedType", "direction"], _sum: { quantity: true } }),
    prisma.feedTransaction.findMany({ where: { date: day }, select: { feedType: true, direction: true, quantity: true, rate: true } }),
    prisma.dailyNote.findUnique({ where: { date: day }, select: { text: true } }),
  ]);

  // litres per cow and shift (several rows for one cow and shift are added up and shown as one number)
  const byCow = new Map<string, { M?: number; A?: number; E?: number }>();
  let groupTotal = 0;
  for (const r of milk) {
    if (!r.cowId) {
      groupTotal += r.litres;
      continue;
    }
    const code = r.shift === "MORNING" ? "M" : r.shift === "AFTERNOON" ? "A" : "E";
    const row = byCow.get(r.cowId) ?? {};
    row[code] = (row[code] ?? 0) + r.litres;
    byCow.set(r.cowId, row);
  }
  const cowRows: CowRow[] = cows
    .sort((a, b) => compareTags(a.tag, b.tag))
    .map((c) => ({ id: c.id, tag: c.tag, m: shown(byCow.get(c.id)?.M), a: shown(byCow.get(c.id)?.A), e: shown(byCow.get(c.id)?.E) }));

  const soldBy = new Map<string, number>();
  for (const s of sales) soldBy.set(s.buyer.toLowerCase(), (soldBy.get(s.buyer.toLowerCase()) ?? 0) + s.litres);
  const customerRows: CustomerRow[] = customers
    .sort((a, b) => rank(BUYER_ORDER, a.name) - rank(BUYER_ORDER, b.name) || a.name.localeCompare(b.name))
    .map((c) => ({ id: c.id, name: c.name, rate: c.agreedRate ?? 0, litres: shown(soldBy.get(c.name.toLowerCase())) }));

  const usedBy = new Map<string, number>();
  for (const u of usage) usedBy.set(u.type, (usedBy.get(u.type) ?? 0) + u.litres);
  const usageRows: UseRow[] = USE_ROWS.map((u) => ({ type: u.type, label: u.label, litres: shown(usedBy.get(u.type)) }));

  const stock = new Map<string, number>();
  for (const s of stockRows) stock.set(s.feedType, (stock.get(s.feedType) ?? 0) + (s.direction === "IN" ? 1 : -1) * (s._sum.quantity ?? 0));
  const todayQty = (name: string, direction: "IN" | "OUT") => {
    const q = feedToday.filter((f) => f.feedType === name && f.direction === direction).reduce((s, f) => s + f.quantity, 0);
    return q > 0 ? shown(q) : "";
  };
  const feedRows: FeedRow[] = items
    .sort((a, b) => rank(FEED_ORDER, a.name) - rank(FEED_ORDER, b.name) || a.name.localeCompare(b.name))
    .map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      stock: stock.get(i.name) ?? 0,
      out: todayQty(i.name, "OUT"),
      in: todayQty(i.name, "IN"),
      inRate: shown(feedToday.find((f) => f.feedType === i.name && f.direction === "IN" && f.rate)?.rate ?? undefined),
    }));

  const version = JSON.stringify([cowRows, customerRows, usageRows, feedRows.map((f) => [f.out, f.in]), note?.text ?? ""]);
  const prev = shiftDate(date, -1);
  const next = date < today ? shiftDate(date, 1) : null;

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Daily Record Sheet</h1>
        <form method="get" className="flex items-center gap-2">
          <Link href={`/entry/daily?date=${prev}`} className="link-btn" aria-label="Previous day">
            ← {prev}
          </Link>
          <input type="date" name="date" defaultValue={date} max={today} className="border border-neutral-300 rounded-md px-2 py-1.5 text-base" />
          <button type="submit" className="link-btn">
            Open day
          </button>
          {next && (
            <Link href={`/entry/daily?date=${next}`} className="link-btn" aria-label="Next day">
              {next} →
            </Link>
          )}
        </form>
      </div>
      <p className="text-sm text-neutral-600">
        One sheet for the whole day, like the paper milk record: milk by cow, milk sold, milk used, feed and a note. Saved figures are locked: you can
        fill in empty boxes, and only an Admin can change what is already saved. Showing <b>{date}</b>.
      </p>
      <DailySheetForm
        date={date}
        cows={cowRows}
        customers={customerRows}
        usage={usageRows}
        feed={feedRows}
        note={note?.text ?? ""}
        version={version}
        groupTotal={groupTotal}
        canFeed={hasPermission(user, "feed", "CREATE")}
        isAdmin={user.role === "ADMIN"}
      />
    </div>
  );
}
