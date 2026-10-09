import { prisma } from "@/lib/prisma";
import { CLASS_LABEL, classifyCash, type CashClassKey } from "@/lib/accounting/cashClass";

// Detail behind the Cash Flow Statement for one year (or all years) or one month of a year: where the money
// came from, where it went by category, and the cost chart. Same classes and same rules as the statement itself.

export type CashFlowSelection = {
  /** null = every year. */
  year: number | null;
  /** 1-12, only with a year. */
  month: number | null;
};

export type CostPoint = {
  label: string;
  /** Running costs, capital spending and money paid to partners. Transfers between books are not money out of the farm. */
  running: number;
  capital: number;
  partners: number;
};

export type CategoryLine = { category: string; amount: number; count: number };
export type CategoryGroup = { cls: CashClassKey; label: string; total: number; count: number; lines: CategoryLine[] };

export type CashFlowDetail = {
  years: number[];
  /** Totals for the chosen period. */
  cashIn: number;
  cashOut: number;
  net: number;
  operating: number;
  investing: number;
  financing: number;
  transfers: number;
  openingCash: number;
  closingCash: number;
  entries: number;
  costChart: CostPoint[];
  chartGrain: "month" | "day";
  inflows: CategoryGroup[];
  outflows: CategoryGroup[];
  /** Totals of everything counted as money out of the farm (costs + capital + partners) for the chart header. */
  totalCosts: number;
  /** Date range of the selection, as YYYY-MM-DD, for linking to the Cash Register. */
  from: string | null;
  to: string | null;
};

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const IN_GROUPS: CashClassKey[] = ["MILK_SALES", "LIVESTOCK_SALES", "OTHER_INCOME", "PARTNER_IN"];
const OUT_GROUPS: CashClassKey[] = ["OPEX", "CAPEX", "PARTNER_OUT"];

const pad = (n: number) => String(n).padStart(2, "0");

export async function getCashFlowDetail(sel: CashFlowSelection): Promise<CashFlowDetail> {
  const rows = await prisma.cashTransaction.findMany({
    select: { date: true, category: true, amountIn: true, amountOut: true, remark: true, accountClass: true },
    orderBy: { date: "asc" },
  });

  const years = [...new Set(rows.map((r) => r.date.getUTCFullYear()))].sort();
  const inSel = (d: Date) => {
    if (sel.year === null) return true;
    if (d.getUTCFullYear() !== sel.year) return false;
    return sel.month === null || d.getUTCMonth() + 1 === sel.month;
  };

  let cashIn = 0, cashOut = 0, operating = 0, investing = 0, financing = 0, transfers = 0, openingCash = 0, entries = 0;
  const groups = new Map<CashClassKey, Map<string, CategoryLine>>();
  const buckets = new Map<string, CostPoint>();
  const grain: "month" | "day" = sel.year !== null && sel.month !== null ? "day" : "month";

  // The chart gets an empty bar for every month of the year / day of the month so gaps are visible.
  if (sel.year !== null && sel.month !== null) {
    const days = new Date(Date.UTC(sel.year, sel.month, 0)).getUTCDate();
    for (let d = 1; d <= days; d++) buckets.set(pad(d), { label: String(d), running: 0, capital: 0, partners: 0 });
  } else if (sel.year !== null) {
    for (let m = 1; m <= 12; m++) buckets.set(pad(m), { label: MONTH_SHORT[m - 1], running: 0, capital: 0, partners: 0 });
  }

  for (const r of rows) {
    const cls = classifyCash(r);
    if (!inSel(r.date)) {
      if (sel.year !== null && r.date < new Date(Date.UTC(sel.year, (sel.month ?? 1) - 1, 1))) openingCash += r.amountIn - r.amountOut;
      continue;
    }
    entries++;
    cashIn += r.amountIn;
    cashOut += r.amountOut;
    const net = r.amountIn - r.amountOut;
    if (cls === "CAPEX") investing += net;
    else if (cls === "PARTNER_IN" || cls === "PARTNER_OUT") financing += net;
    else if (cls === "TRANSFER") transfers += net;
    else if (cls !== "OPENING" && cls !== "REVIEW") operating += net;

    // Category breakdown. Money in counts for the income and partner-in groups, money out (less refunds) for the cost groups.
    const isIn = IN_GROUPS.includes(cls);
    const isOut = OUT_GROUPS.includes(cls);
    if (isIn || isOut) {
      const amount = isIn ? r.amountIn - r.amountOut : r.amountOut - r.amountIn;
      const cats = groups.get(cls) ?? new Map<string, CategoryLine>();
      const line = cats.get(r.category) ?? { category: r.category, amount: 0, count: 0 };
      line.amount += amount;
      line.count += 1;
      cats.set(r.category, line);
      groups.set(cls, cats);
    }

    // Cost chart.
    if (isOut) {
      const cost = r.amountOut - r.amountIn;
      const key = grain === "day" ? pad(r.date.getUTCDate()) : sel.year !== null ? pad(r.date.getUTCMonth() + 1) : `${r.date.getUTCFullYear()}-${pad(r.date.getUTCMonth() + 1)}`;
      let b = buckets.get(key);
      if (!b) {
        const label = grain === "month" && sel.year === null ? `${MONTH_SHORT[r.date.getUTCMonth()]} ${String(r.date.getUTCFullYear()).slice(2)}` : key;
        b = { label, running: 0, capital: 0, partners: 0 };
        buckets.set(key, b);
      }
      if (cls === "OPEX") b.running += cost;
      else if (cls === "CAPEX") b.capital += cost;
      else b.partners += cost;
    }
  }

  const toGroups = (order: CashClassKey[]): CategoryGroup[] =>
    order
      .map((cls) => {
        const cats = groups.get(cls);
        if (!cats) return null;
        const lines = [...cats.values()].filter((l) => Math.round(l.amount) !== 0).sort((a, b) => b.amount - a.amount);
        if (lines.length === 0) return null;
        return { cls, label: CLASS_LABEL[cls], total: lines.reduce((n, l) => n + l.amount, 0), count: lines.reduce((n, l) => n + l.count, 0), lines };
      })
      .filter((g): g is CategoryGroup => g !== null);

  const costChart = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  const outflows = toGroups(OUT_GROUPS);

  let from: string | null = null;
  let to: string | null = null;
  if (sel.year !== null) {
    if (sel.month !== null) {
      from = `${sel.year}-${pad(sel.month)}-01`;
      to = `${sel.year}-${pad(sel.month)}-${pad(new Date(Date.UTC(sel.year, sel.month, 0)).getUTCDate())}`;
    } else {
      from = `${sel.year}-01-01`;
      to = `${sel.year}-12-31`;
    }
  }

  return {
    years,
    cashIn,
    cashOut,
    net: cashIn - cashOut,
    operating,
    investing,
    financing,
    transfers,
    openingCash: sel.year === null ? 0 : openingCash,
    closingCash: (sel.year === null ? 0 : openingCash) + cashIn - cashOut,
    entries,
    costChart,
    chartGrain: grain,
    inflows: toGroups(IN_GROUPS),
    outflows,
    totalCosts: outflows.reduce((n, g) => n + g.total, 0),
    from,
    to,
  };
}
