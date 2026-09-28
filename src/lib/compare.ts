// Shared period-over-period comparison logic, used by every section's stat
// strip (Herd, Breeding, Milk, Feed, Financial) to show a trend the way
// Channab's dashboards do ("Monthly profit and loss trends", "Rising/
// falling producer identification") instead of a bare current-period number.
export type Trend = "up" | "down" | "flat";

export type Comparison = {
  current: number;
  previous: number;
  deltaPct: number | null; // null when previous is 0 (percent change is undefined)
  trend: Trend;
};

export function compare(current: number, previous: number): Comparison {
  const diff = current - previous;
  const deltaPct = previous !== 0 ? (diff / Math.abs(previous)) * 100 : null;
  const trend: Trend = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  return { current, previous, deltaPct, trend };
}

/** Start-of-month Date objects for the current and previous calendar month, plus the month after current (for a half-open range). */
export function monthRanges(referenceDate = new Date()) {
  const y = referenceDate.getFullYear();
  const m = referenceDate.getMonth();
  return {
    currentStart: new Date(y, m, 1),
    nextStart: new Date(y, m + 1, 1),
    previousStart: new Date(y, m - 1, 1),
  };
}
