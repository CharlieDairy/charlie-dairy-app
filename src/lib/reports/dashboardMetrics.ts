// Farm entry dates are stored as UTC date-only values. Select today's date
// in Pakistan, then query those stored date keys (not the server timezone).
export function farmDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function dateBounds(key: string) {
  const start = new Date(`${key}T00:00:00.000Z`);
  return { start, end: new Date(start.getTime() + 86400000) };
}

export function milkSession(rows: { cowId: string | null; litres: number }[], expectedIds: string[]) {
  const recorded = new Set(rows.flatMap(r => r.cowId ? [r.cowId] : []));
  const identifiedLitres = rows.filter(r => r.cowId).reduce((sum, r) => sum + r.litres, 0);
  return {
    litres: rows.reduce((sum, r) => sum + r.litres, 0),
    records: rows.length,
    recorded: recorded.size,
    missing: expectedIds.filter(id => !recorded.has(id)).length,
    average: recorded.size ? identifiedLitres / recorded.size : null,
  };
}

export function cashTotals(rows: { mode: string; amountIn: number; amountOut: number }[]) {
  return rows.reduce((s, r) => {
    const net = r.amountIn - r.amountOut;
    if (r.mode === "BANK") s.bank += net; else s.cash += net;
    s.receipts += r.amountIn;
    s.payments += r.amountOut;
    return s;
  }, { cash: 0, bank: 0, receipts: 0, payments: 0 });
}

export function validDay(value: string | undefined, fallback: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value ? value : fallback;
}

export function periodBounds(period: string, today: string, from?: string, to?: string) {
  const now = dateBounds(today).start;
  let start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  let end = dateBounds(today).end;
  if (period === "week") start = new Date(now.getTime() - ((now.getUTCDay() + 6) % 7) * 86400000);
  if (period === "last-month") { end = start; start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)); }
  if (period === "quarter") start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  if (period === "year") start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  if (period === "last-year") { start = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1)); end = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)); }
  if (period === "custom") {
    start = dateBounds(validDay(from, today)).start;
    end = dateBounds(validDay(to, today)).end;
    if (end <= start) end = new Date(start.getTime() + 86400000);
  }
  return { start, end };
}
