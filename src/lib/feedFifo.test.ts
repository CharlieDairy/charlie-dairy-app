import { test } from "node:test";
import assert from "node:assert/strict";
import { runFifo, type FifoTx } from "./feedFifo";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const IN = (id: string, date: string, quantity: number, rate: number | null): FifoTx => ({ id, date: d(date), direction: "IN", quantity, rate });
const OUT = (id: string, date: string, quantity: number, rate: number | null = null): FifoTx => ({ id, date: d(date), direction: "OUT", quantity, rate });

test("an issue is costed from the oldest purchase first", () => {
  const r = runFifo([IN("a", "2026-01-01", 100, 10), IN("b", "2026-01-05", 100, 20), OUT("o1", "2026-01-10", 60)]);
  assert.equal(r.issues.get("o1")?.cost, 600); // 60 from the Rs 10 layer
  assert.equal(r.issues.get("o1")?.fifoQty, 60);
});

test("an issue that crosses two purchases takes each at its own rate", () => {
  const r = runFifo([IN("a", "2026-01-01", 100, 10), IN("b", "2026-01-05", 100, 20), OUT("o1", "2026-01-10", 150)]);
  assert.equal(r.issues.get("o1")?.cost, 100 * 10 + 50 * 20);
});

test("later issues carry on from the leftover of the older purchase", () => {
  const r = runFifo([IN("a", "2026-01-01", 100, 10), IN("b", "2026-01-05", 100, 20), OUT("o1", "2026-01-10", 60), OUT("o2", "2026-01-11", 60)]);
  assert.equal(r.issues.get("o2")?.cost, 40 * 10 + 20 * 20);
  assert.equal(r.onHand, 80);
  assert.equal(r.stockValue, 80 * 20);
});

test("stock on hand is valued at the rates of the layers still left", () => {
  const r = runFifo([IN("a", "2026-01-01", 100, 10), IN("b", "2026-01-05", 50, 30), OUT("o1", "2026-01-10", 120)]);
  assert.equal(r.onHand, 30);
  assert.equal(r.stockValue, 30 * 30);
  assert.equal(r.layers.length, 1);
  assert.equal(r.layers[0].id, "b");
});

test("a backdated purchase changes the cost of the issues after it", () => {
  const before = runFifo([IN("b", "2026-01-05", 100, 20), OUT("o1", "2026-01-10", 50)]);
  const after = runFifo([IN("a", "2026-01-01", 100, 10), IN("b", "2026-01-05", 100, 20), OUT("o1", "2026-01-10", 50)]);
  assert.equal(before.issues.get("o1")?.cost, 1000);
  assert.equal(after.issues.get("o1")?.cost, 500);
});

test("on the same day a receipt is used before the issue, whatever the entry order", () => {
  const r = runFifo([OUT("o1", "2026-01-05", 10), IN("a", "2026-01-05", 10, 7)]);
  assert.equal(r.issues.get("o1")?.cost, 70);
  assert.equal(r.issues.get("o1")?.shortfallQty, 0);
});

test("a purchase with no rate falls back to the issue's own old rate and is marked estimated", () => {
  const r = runFifo([IN("a", "2026-01-01", 100, null), OUT("o1", "2026-01-02", 40, 15)]);
  assert.equal(r.issues.get("o1")?.cost, 600);
  assert.equal(r.issues.get("o1")?.estimatedQty, 40);
  assert.equal(r.issues.get("o1")?.fifoQty, 0);
});

test("an unrated purchase uses the latest known rate when the issue has none", () => {
  const r = runFifo([IN("a", "2026-01-01", 50, 12), IN("b", "2026-01-02", 100, null), OUT("o1", "2026-01-03", 80)]);
  // 50 from layer a at 12, then 30 from the unrated layer at the latest known rate (12)
  assert.equal(r.issues.get("o1")?.cost, 50 * 12 + 30 * 12);
  assert.equal(r.issues.get("o1")?.estimatedQty, 30);
});

test("an issue beyond the stock on hand is a shortfall costed at a fallback rate", () => {
  const r = runFifo([IN("a", "2026-01-01", 10, 8), OUT("o1", "2026-01-02", 25)]);
  const i = r.issues.get("o1")!;
  assert.equal(i.shortfallQty, 15);
  assert.equal(i.cost, 10 * 8 + 15 * 8);
  assert.equal(r.onHand, 0);
});

test("an issue that cannot be priced at all has no cost", () => {
  const r = runFifo([OUT("o1", "2026-01-02", 25)]);
  assert.equal(r.issues.get("o1")?.cost, null);
  assert.equal(r.issues.get("o1")?.unpricedQty, 25);
});

test("fractional quantities leave no phantom stock", () => {
  const r = runFifo([IN("a", "2026-01-01", 0.3, 10), OUT("o1", "2026-01-02", 0.1), OUT("o2", "2026-01-02", 0.2)]);
  assert.equal(r.layers.length, 0);
  assert.equal(r.issues.get("o2")?.shortfallQty, 0);
});
