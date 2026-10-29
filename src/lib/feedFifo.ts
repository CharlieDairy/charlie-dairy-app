// First-in, first-out costing for feed. Pure: no database access, so it can be tested and reused by the entry actions and
// the Feed & Inventory report.
//
// Every receipt (IN) is a layer of stock with its own purchase rate. Every issue (OUT) uses up the oldest layers first,
// and its cost is the quantity taken from each layer times that layer's rate. Whatever is left is the closing stock,
// valued at the rates of the layers still on hand.
//
// Two gaps exist in the farm's history, and the engine handles them without inventing numbers:
//  - A receipt with no rate recorded (most older Silage, Turi and Wheat Straw purchases). Its stock is costed at the
//    rate the issue itself was entered with (the old hand-typed rate), else the latest rate known so far.
//  - An issue larger than the stock on hand (opening stock or a purchase was never entered). The shortfall is costed
//    the same way.
// Both are reported as "estimated" quantities so the screens can say so, and the Admin can fix them by entering the
// missing rate or purchase.

export type FifoTx = {
  id: string;
  date: Date;
  createdAt?: Date;
  direction: "IN" | "OUT";
  quantity: number;
  rate: number | null; // IN: purchase rate. OUT: the old hand-typed rate, used only as a fallback.
};

export type FifoLayer = {
  id: string;
  date: Date;
  quantity: number; // originally received
  remaining: number;
  rate: number | null; // null = no purchase rate recorded
  valueRate: number | null; // rate used to value what is left (the layer's own, else the latest known)
};

export type FifoIssue = {
  cost: number | null; // null when part of the issue could not be priced at all
  fifoQty: number; // quantity costed from a layer's own purchase rate
  estimatedQty: number; // quantity costed at a fallback rate (no purchase rate, or stock ran out)
  unpricedQty: number; // quantity that could not be priced
  shortfallQty: number; // part of the issue beyond the stock on hand (also counted in estimated / unpriced)
};

export type FifoResult = {
  issues: Map<string, FifoIssue>;
  layers: FifoLayer[]; // stock still on hand, oldest first
  onHand: number;
  stockValue: number; // value of the stock on hand
  stockValueEstimated: number; // part of stockValue that rests on a fallback rate
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const EPS = 1e-9;

export function runFifo(input: FifoTx[]): FifoResult {
  // Same day: receipts before issues, so what arrived in the morning can be used in the afternoon.
  const txs = [...input].sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      (a.direction === b.direction ? 0 : a.direction === "IN" ? -1 : 1) ||
      (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0) ||
      a.id.localeCompare(b.id)
  );

  const firstKnown = txs.find((t) => t.direction === "IN" && t.rate !== null && t.rate > 0)?.rate ?? null;
  let lastKnown: number | null = null; // latest rate seen so far, used when nothing better exists
  const layers: FifoLayer[] = [];
  const issues = new Map<string, FifoIssue>();

  for (const t of txs) {
    if (t.direction === "IN") {
      if (t.rate !== null && t.rate > 0) lastKnown = t.rate;
      layers.push({ id: t.id, date: t.date, quantity: t.quantity, remaining: t.quantity, rate: t.rate !== null && t.rate > 0 ? t.rate : null, valueRate: null });
      continue;
    }

    const legacy = t.rate !== null && t.rate > 0 ? t.rate : null;
    const fallback = legacy ?? lastKnown ?? firstKnown;
    let need = t.quantity;
    let cost = 0;
    const issue: FifoIssue = { cost: null, fifoQty: 0, estimatedQty: 0, unpricedQty: 0, shortfallQty: 0 };

    const take = (qty: number, rate: number | null, fromLayer: boolean) => {
      if (rate !== null) {
        cost += qty * rate;
        if (fromLayer) issue.fifoQty += qty;
        else issue.estimatedQty += qty;
      } else {
        issue.unpricedQty += qty;
      }
    };

    for (const layer of layers) {
      if (need <= EPS) break;
      if (layer.remaining <= EPS) continue;
      const qty = Math.min(layer.remaining, need);
      layer.remaining -= qty;
      need -= qty;
      if (layer.rate !== null) take(qty, layer.rate, true);
      else take(qty, fallback, false);
    }
    if (need > EPS) {
      issue.shortfallQty = need;
      take(need, fallback, false);
    }
    if (legacy !== null) lastKnown = legacy;
    issue.cost = issue.unpricedQty > EPS ? null : round2(cost);
    issues.set(t.id, issue);
  }

  // Value what is left. A layer with no rate is valued at the latest known rate and counted as estimated.
  const left = layers.filter((l) => l.remaining > EPS);
  let stockValue = 0;
  let stockValueEstimated = 0;
  for (const l of left) {
    l.valueRate = l.rate ?? lastKnown ?? firstKnown;
    const v = l.valueRate !== null ? l.remaining * l.valueRate : 0;
    stockValue += v;
    if (l.rate === null) stockValueEstimated += v;
  }

  return {
    issues,
    layers: left,
    onHand: left.reduce((n, l) => n + l.remaining, 0),
    stockValue: round2(stockValue),
    stockValueEstimated: round2(stockValueEstimated),
  };
}
