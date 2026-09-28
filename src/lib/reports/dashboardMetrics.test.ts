import test from "node:test";
import assert from "node:assert/strict";
import { cashTotals, dateBounds, farmDateKey, milkSession, periodBounds, validDay } from "./dashboardMetrics";

test("Pakistan calendar date crosses UTC midnight correctly", () => {
  assert.equal(farmDateKey(new Date("2026-09-27T20:00:00Z")), "2026-09-28");
  assert.equal(dateBounds("2026-09-28").start.toISOString(), "2026-09-28T00:00:00.000Z");
});
test("zero production is a recorded entry; duplicates do not increase cow count", () => {
  const result = milkSession([{ cowId: "a", litres: 0 }, { cowId: "a", litres: 5 }, { cowId: null, litres: 20 }], ["a", "b"]);
  assert.equal(result.recorded, 1);
  assert.equal(result.missing, 1);
  assert.equal(result.litres, 25);
  assert.equal(result.average, 5);
  assert.equal(milkSession([], ["a"]).average, null);
});
test("cash balances use movements, with cash and bank kept separate", () => {
  assert.deepEqual(cashTotals([{ mode: "CASH", amountIn: 100, amountOut: 20 }, { mode: "BANK", amountIn: 500, amountOut: 100 }]), { cash: 80, bank: 400, receipts: 600, payments: 120 });
});
test("period filters cover leap months, Monday weeks and inclusive custom end dates", () => {
  const leap = periodBounds("last-month", "2024-03-15");
  assert.equal((leap.end.getTime() - leap.start.getTime()) / 86400000, 29);
  assert.equal(periodBounds("week", "2026-09-28").start.toISOString().slice(0, 10), "2026-09-28");
  const custom = periodBounds("custom", "2026-09-28", "2026-09-01", "2026-09-05");
  assert.equal(custom.end.toISOString().slice(0, 10), "2026-09-06");
  assert.equal(validDay("2026-02-30", "2026-09-28"), "2026-09-28");
});
