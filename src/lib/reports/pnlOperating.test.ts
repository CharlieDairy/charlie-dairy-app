import { test } from "node:test";
import assert from "node:assert/strict";
import { operatingTotals } from "./pnlOperating";
import { CASH_CLASSES } from "@/lib/accounting/cashClass";

const month = (milk: number, animals: number, other: number, cost: number) => {
  const byClass = Object.fromEntries(CASH_CLASSES.map((c) => [c, 0])) as Record<(typeof CASH_CLASSES)[number], number>;
  byClass.MILK_SALES = milk;
  byClass.LIVESTOCK_SALES = animals;
  byClass.OTHER_INCOME = other;
  return { byClass, expense: cost };
};

test("animal and calf sales are left out of the operating revenue", () => {
  const t = operatingTotals([month(1000, 500, 50, 0)]);
  assert.equal(t.revenue, 1050);
  assert.equal(t.animalSalesExcluded, 500);
});

test("every operating cost stays in", () => {
  const t = operatingTotals([month(1000, 500, 0, 400), month(800, 0, 0, 300)]);
  assert.equal(t.cost, 700);
  assert.equal(t.net, 1800 - 700);
});

test("operating profit plus the excluded animal sales equals the full statement's net profit", () => {
  const months = [month(1000, 500, 50, 400), month(800, 250, 0, 300)];
  const t = operatingTotals(months);
  const fullNet = months.reduce((n, m) => n + m.byClass.MILK_SALES + m.byClass.LIVESTOCK_SALES + m.byClass.OTHER_INCOME - m.expense, 0);
  assert.equal(t.net + t.animalSalesExcluded, fullNet);
});

test("a loss shows as negative and the margin follows it", () => {
  const t = operatingTotals([month(1000, 5000, 0, 1500)]);
  assert.equal(t.net, -500);
  assert.equal(t.marginPct, -50);
});

test("no revenue gives no margin instead of dividing by zero", () => {
  const t = operatingTotals([month(0, 900, 0, 200)]);
  assert.equal(t.marginPct, null);
  assert.equal(t.net, -200);
});

test("nothing in the period gives zeros", () => {
  const t = operatingTotals([]);
  assert.deepEqual([t.revenue, t.cost, t.net, t.animalSalesExcluded], [0, 0, 0, 0]);
});
