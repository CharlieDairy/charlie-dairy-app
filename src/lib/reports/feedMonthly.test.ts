import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyStock, type StockMove } from "./feedMonthly";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const IN = (id: string, date: string, quantity: number): StockMove => ({ id, date: d(date), direction: "IN", quantity });
const OUT = (id: string, date: string, quantity: number): StockMove => ({ id, date: d(date), direction: "OUT", quantity });

test("what is left at the end of a month is what was available after the 1st receipt minus what was used", () => {
  const rows = monthlyStock([IN("a", "2026-01-01", 350), OUT("o1", "2026-01-10", 100), OUT("o2", "2026-01-20", 150)]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { month: "2026-01", opening: 0, received: 350, available: 350, used: 250, closing: 100, usedCost: null });
});

test("the end-of-month figure becomes next month's opening, and the new 350 is added on top", () => {
  const rows = monthlyStock([IN("a", "2026-01-01", 350), OUT("o1", "2026-01-15", 250), IN("b", "2026-02-01", 350), OUT("o2", "2026-02-15", 240)]);
  assert.equal(rows[0].closing, 100);
  assert.equal(rows[1].opening, 100);
  assert.equal(rows[1].available, 450);
  assert.equal(rows[1].closing, 210);
});

test("a month with no entries still shows, carrying the stock forward", () => {
  const rows = monthlyStock([IN("a", "2026-01-01", 350), OUT("o1", "2026-01-31", 50), OUT("o2", "2026-03-05", 20)]);
  assert.deepEqual(rows.map((r) => r.month), ["2026-01", "2026-02", "2026-03"]);
  assert.deepEqual(rows[1], { month: "2026-02", opening: 300, received: 0, available: 300, used: 0, closing: 300, usedCost: null });
  assert.equal(rows[2].closing, 280);
});

test("a month that spans a year end carries over correctly", () => {
  const rows = monthlyStock([IN("a", "2025-12-01", 350), OUT("o1", "2025-12-20", 200), IN("b", "2026-01-01", 350)]);
  assert.deepEqual(rows.map((r) => r.month), ["2025-12", "2026-01"]);
  assert.equal(rows[1].opening, 150);
  assert.equal(rows[1].closing, 500);
});

test("the cost used in a month adds up the cost of that month's issues", () => {
  const costs: Record<string, number> = { o1: 1000.5, o2: 2000.25 };
  const rows = monthlyStock([IN("a", "2026-01-01", 350), OUT("o1", "2026-01-10", 3), OUT("o2", "2026-01-11", 6)], (id) => costs[id] ?? null);
  assert.equal(rows[0].usedCost, 3000.75);
});

test("a deficit shows as a negative month-end figure instead of being hidden", () => {
  const rows = monthlyStock([OUT("o1", "2026-01-10", 40)]);
  assert.equal(rows[0].closing, -40);
});

test("fractions do not leave floating-point dust", () => {
  const rows = monthlyStock([IN("a", "2026-01-01", 0.3), OUT("o1", "2026-01-02", 0.1), OUT("o2", "2026-01-03", 0.2)]);
  assert.equal(rows[0].closing, 0);
});

test("no movements gives no rows", () => {
  assert.deepEqual(monthlyStock([]), []);
});
