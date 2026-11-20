import { test } from "node:test";
import assert from "node:assert/strict";
import { findRecurringGaps, monthsToCheck, shiftMonth, type CostRow } from "./opexRecurring";

const row = (month: string, category: string, remark: string, amount: number): CostRow => ({ month, category, remark, amount });
// Six normal months (2026-04 .. 2026-09), then October: salaries for Abdul Basit and Taha, fuel, A.I.
const normal = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"].flatMap((m) => [
  row(m, "Opex Salaries", "Abdul Basit salary", 60000),
  row(m, "Opex Salaries", "Taha salary", 20000),
  row(m, "Opex Fuel", "Petrol", 15000),
  row(m, "A.I", "semen", 12000),
]);
const people = [{ name: "Abdul Basit", active: true }, { name: "Taha", active: true }, { name: "Old Hand", active: false }];

test("month arithmetic crosses a year end", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-11", 3), "2027-02");
});

test("the month just finished is checked, and the current month only from the 26th", () => {
  assert.deepEqual(monthsToCheck("2026-11-20"), ["2026-10"]);
  assert.deepEqual(monthsToCheck("2026-11-26"), ["2026-10", "2026-11"]);
});

test("nothing is flagged when every recurring cost is there", () => {
  const rows = [...normal, row("2026-10", "Opex Salaries", "Abdul Basit salary", 60000), row("2026-10", "Opex Salaries", "Taha salary", 20000), row("2026-10", "Opex Fuel", "Petrol", 14000), row("2026-10", "A.I", "semen", 11000)];
  assert.deepEqual(findRecurringGaps(rows, people, "2026-11-20"), []);
});

test("a missing salary is named, and an inactive person is ignored", () => {
  const rows = [...normal, row("2026-10", "Opex Salaries", "Abdul Basit salary", 60000), row("2026-10", "Opex Fuel", "Petrol", 14000), row("2026-10", "A.I", "semen", 11000)];
  const f = findRecurringGaps(rows, people, "2026-11-20");
  assert.equal(f.length, 1);
  assert.equal(f[0].title, "No salary recorded for Taha in October 2026");
  assert.equal(f[0].financeOnly, true);
});

test("a salary written with only part of the name still counts", () => {
  const short = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"].map((m) => row(m, "Opex Salaries", "Basit salary", 60000));
  const f = findRecurringGaps(short, [{ name: "Abdul Basit", active: true }], "2026-11-20");
  assert.equal(f.some((x) => x.key === "opex.salary.abdul basit.2026-10"), true);
});

test("a recurring cost category that is absent is reported, a one-off category is not", () => {
  const rows = [...normal, row("2026-04", "Mobilization", "one off", 15000), row("2026-10", "Opex Salaries", "Abdul Basit salary", 60000), row("2026-10", "Opex Salaries", "Taha salary", 20000), row("2026-10", "A.I", "semen", 11000), row("2026-10", "Opex", "repair", 60000)];
  const f = findRecurringGaps(rows, people, "2026-11-20");
  assert.deepEqual(f.map((x) => x.key), ["opex.category.opex fuel.2026-10"]);
});

test("a month far below the usual total is flagged as incomplete", () => {
  const rows = [...normal, row("2026-10", "Opex Salaries", "Taha salary", 20000), row("2026-10", "Opex Fuel", "Petrol", 10000)];
  const keys = findRecurringGaps(rows, people, "2026-11-20").map((x) => x.key);
  assert.ok(keys.includes("opex.total.2026-10"));
});

test("with too little history nothing is called recurring", () => {
  const rows = [row("2026-09", "Opex Salaries", "Taha salary", 20000)];
  assert.deepEqual(findRecurringGaps(rows, people, "2026-11-20"), []);
});
