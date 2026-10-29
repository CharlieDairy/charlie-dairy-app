import { test } from "node:test";
import assert from "node:assert/strict";
import { findStockBreach, type StockTx } from "./feedStock";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const IN = (id: string, date: string, quantity: number): StockTx => ({ id, date: d(date), direction: "IN", quantity });
const OUT = (id: string, date: string, quantity: number): StockTx => ({ id, date: d(date), direction: "OUT", quantity });

test("an issue with no purchase at all is refused", () => {
  const b = findStockBreach([], [OUT("n", "2026-10-05", 10)]);
  assert.deepEqual(b, { date: "2026-10-05", available: 0, short: 10 });
});

test("an issue within the stock on hand is allowed", () => {
  const before = [IN("a", "2026-10-01", 100), OUT("o", "2026-10-02", 30)];
  assert.equal(findStockBreach(before, [...before, OUT("n", "2026-10-03", 70)]), null);
});

test("an issue beyond the stock on hand is refused and says how much was there", () => {
  const before = [IN("a", "2026-10-01", 100), OUT("o", "2026-10-02", 30)];
  const b = findStockBreach(before, [...before, OUT("n", "2026-10-03", 80)]);
  assert.deepEqual(b, { date: "2026-10-03", available: 70, short: 10 });
});

test("a purchase received the same day can be used that day", () => {
  assert.equal(findStockBreach([], [IN("a", "2026-10-05", 10), OUT("n", "2026-10-05", 10)]), null);
});

test("an issue dated before the purchase is refused", () => {
  const before = [IN("a", "2026-10-10", 100)];
  const b = findStockBreach(before, [...before, OUT("n", "2026-10-05", 5)]);
  assert.equal(b?.date, "2026-10-05");
  assert.equal(b?.available, 0);
});

test("a back-dated issue is refused when it starves a later issue", () => {
  const before = [IN("a", "2026-10-01", 100), OUT("o", "2026-10-10", 90)];
  const b = findStockBreach(before, [...before, OUT("n", "2026-10-05", 20)]);
  assert.equal(b?.date, "2026-10-10");
  assert.equal(b?.short, 10);
});

test("removing a purchase that was already used is refused", () => {
  const before = [IN("a", "2026-10-01", 100), OUT("o", "2026-10-02", 60)];
  const b = findStockBreach(before, before.filter((t) => t.id !== "a"));
  assert.equal(b?.date, "2026-10-02");
});

test("cutting a purchase's quantity below what was used is refused", () => {
  const before = [IN("a", "2026-10-01", 100), OUT("o", "2026-10-02", 60)];
  const b = findStockBreach(before, [IN("a", "2026-10-01", 50), OUT("o", "2026-10-02", 60)]);
  assert.equal(b?.short, 10);
});

test("a deficit that was already there does not block unrelated changes", () => {
  const before = [OUT("o", "2026-10-02", 40)]; // grown feed with no purchases
  assert.equal(findStockBreach(before, [...before, IN("n", "2026-10-03", 5)]), null);
});

test("but a deficit that was already there cannot grow", () => {
  const before = [OUT("o", "2026-10-02", 40)];
  assert.ok(findStockBreach(before, [...before, OUT("n", "2026-10-03", 1)]));
});

test("deleting an issue is always fine", () => {
  const before = [IN("a", "2026-10-01", 10), OUT("o", "2026-10-02", 10)];
  assert.equal(findStockBreach(before, [IN("a", "2026-10-01", 10)]), null);
});

test("fractions do not trigger a false refusal", () => {
  const before = [IN("a", "2026-10-01", 0.3)];
  assert.equal(findStockBreach(before, [...before, OUT("x", "2026-10-02", 0.1), OUT("y", "2026-10-02", 0.2)]), null);
});
