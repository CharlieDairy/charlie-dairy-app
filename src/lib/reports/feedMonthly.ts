// Month-by-month stock of one feed, as a plain roll-forward:
//   left from last month + received = available after the receipt; available - used = left at the end of the month.
// The end-of-month figure is the next month's opening. Pure, so it is tested without a database.

export type StockMove = { id: string; date: Date; direction: "IN" | "OUT"; quantity: number };

export type MonthStockRow = {
  month: string; // "YYYY-MM"
  opening: number; // left over from the month before
  received: number; // bought or received during the month (for example 350 on the 1st)
  available: number; // opening + received
  used: number; // issued during the month
  closing: number; // available - used: what is left at the end of the month
  usedCost: number | null; // first-in, first-out cost of what was used, null when no costs were given
};

// "+ 0" turns a negative zero (what 0.3 - 0.1 - 0.2 rounds to) into a plain 0.
const r3 = (n: number) => Math.round(n * 1000) / 1000 + 0;
const key = (d: Date) => d.toISOString().slice(0, 7);

export function monthlyStock(moves: StockMove[], costOf?: (id: string) => number | null): MonthStockRow[] {
  if (moves.length === 0) return [];
  const sorted = [...moves].sort((a, b) => a.date.getTime() - b.date.getTime());
  const first = sorted[0].date;
  const last = sorted[sorted.length - 1].date;

  const net = new Map<string, { in: number; out: number; cost: number }>();
  for (const m of sorted) {
    const e = net.get(key(m.date)) ?? { in: 0, out: 0, cost: 0 };
    if (m.direction === "IN") e.in += m.quantity;
    else {
      e.out += m.quantity;
      e.cost += costOf?.(m.id) ?? 0;
    }
    net.set(key(m.date), e);
  }

  const rows: MonthStockRow[] = [];
  let y = first.getUTCFullYear();
  let mo = first.getUTCMonth() + 1;
  const endKey = key(last);
  let carry = 0;
  for (;;) {
    const k = `${y}-${String(mo).padStart(2, "0")}`;
    const e = net.get(k) ?? { in: 0, out: 0, cost: 0 };
    const available = carry + e.in;
    const closing = available - e.out;
    rows.push({ month: k, opening: r3(carry), received: r3(e.in), available: r3(available), used: r3(e.out), closing: r3(closing), usedCost: costOf ? Math.round(e.cost * 100) / 100 : null });
    carry = r3(closing);
    if (k >= endKey) break;
    mo++;
    if (mo > 12) {
      mo = 1;
      y++;
    }
  }
  return rows;
}
