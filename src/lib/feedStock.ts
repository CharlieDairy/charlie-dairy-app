// "No issue without stock": feed can only be used (or a purchase removed) if the stock was already there.
// Pure: compares the running stock of a feed before and after a proposed change.
//
// Stock on a day = purchases up to and including that day minus issues up to and including that day (a purchase made
// in the morning can be used the same day). A change is refused when it leaves the stock below zero on some day
// AND makes that day worse than it already was. The second part matters because older history already has a few
// deficits (for example grown Fodder with no purchases); those must not block every future entry, but they must not
// be allowed to grow either.

export type StockTx = { id: string; date: Date; direction: "IN" | "OUT"; quantity: number };

export type StockBreach = {
  date: string; // YYYY-MM-DD: the first day the stock would be short
  available: number; // stock that really was available that day, before this change
  short: number; // how far below zero the change would take it
};

const EPS = 1e-6;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

function netPerDay(txs: StockTx[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of txs) m.set(dayKey(t.date), (m.get(dayKey(t.date)) ?? 0) + (t.direction === "IN" ? t.quantity : -t.quantity));
  return m;
}

/** The first day on which `after` leaves the stock short and worse than `before` did, or null when the change is fine. */
export function findStockBreach(before: StockTx[], after: StockTx[]): StockBreach | null {
  const b = netPerDay(before);
  const a = netPerDay(after);
  const days = [...new Set([...b.keys(), ...a.keys()])].sort();
  let balBefore = 0;
  let balAfter = 0;
  for (const day of days) {
    balBefore += b.get(day) ?? 0;
    balAfter += a.get(day) ?? 0;
    if (balAfter < -EPS && balAfter < balBefore - EPS) {
      return { date: day, available: Math.max(0, Math.round(balBefore * 1000) / 1000), short: Math.round(-balAfter * 1000) / 1000 };
    }
  }
  return null;
}
