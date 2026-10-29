import { test } from "node:test";
import assert from "node:assert/strict";
import { inSelection, parsePnlSelection, priorSelection, selectionLabel, selectionQuery } from "./pnlPeriod";

const TODAY = "2026-10-29";
const months = (sel: ReturnType<typeof parsePnlSelection>) =>
  ["2025-03", "2025-10", "2025-12", "2026-01", "2026-09", "2026-10", "2026-11", "2026-12"].filter((m) => inSelection(sel, m, TODAY));

test("with nothing chosen the page shows the current year", () => {
  assert.deepEqual(parsePnlSelection({}, TODAY), { range: "whole", year: 2026, month: null });
});

test("all years, a chosen year, year to date and a month are all understood", () => {
  assert.equal(parsePnlSelection({ year: "all" }, TODAY).range, "all");
  assert.deepEqual(parsePnlSelection({ year: "2025" }, TODAY), { range: "whole", year: 2025, month: null });
  assert.deepEqual(parsePnlSelection({ year: "2025", range: "ytd" }, TODAY), { range: "ytd", year: 2025, month: null });
  assert.deepEqual(parsePnlSelection({ year: "2026", month: "5" }, TODAY), { range: "month", year: 2026, month: 5 });
});

test("rubbish in the address falls back to the current year", () => {
  assert.deepEqual(parsePnlSelection({ year: "abc", month: "13", range: "x" }, TODAY), { range: "whole", year: 2026, month: null });
});

test("a whole year takes every month of that year only", () => {
  assert.deepEqual(months(parsePnlSelection({ year: "2026" }, TODAY)), ["2026-01", "2026-09", "2026-10", "2026-11", "2026-12"]);
});

test("year to date stops at the current month of the year", () => {
  assert.deepEqual(months(parsePnlSelection({ year: "2026", range: "ytd" }, TODAY)), ["2026-01", "2026-09", "2026-10"]);
});

test("year to date of an earlier year runs to the same month, so the two years compare like for like", () => {
  assert.deepEqual(months(parsePnlSelection({ year: "2025", range: "ytd" }, TODAY)), ["2025-03", "2025-10"]);
});

test("a month is only that month, and all years is everything", () => {
  assert.deepEqual(months(parsePnlSelection({ year: "2026", month: "9" }, TODAY)), ["2026-09"]);
  assert.equal(months(parsePnlSelection({ year: "all" }, TODAY)).length, 8);
});

test("the comparison period is last year, last year to the same month, or the month before", () => {
  assert.equal(priorSelection(parsePnlSelection({ year: "2026" }, TODAY), TODAY)?.label, "2025");
  assert.equal(priorSelection(parsePnlSelection({ year: "2026", range: "ytd" }, TODAY), TODAY)?.label, "Jan to Oct 2025");
  assert.equal(priorSelection(parsePnlSelection({ year: "2026", month: "9" }, TODAY), TODAY)?.label, "Aug 2026");
  assert.equal(priorSelection(parsePnlSelection({ year: "2026", month: "1" }, TODAY), TODAY)?.label, "Dec 2025");
  assert.equal(priorSelection(parsePnlSelection({ year: "all" }, TODAY), TODAY), null);
});

test("labels and links read back the same selection", () => {
  assert.equal(selectionLabel(parsePnlSelection({ year: "2026", range: "ytd" }, TODAY), TODAY), "Year to date: Jan to Oct 2026");
  assert.equal(selectionLabel(parsePnlSelection({ year: "2026", month: "3" }, TODAY), TODAY), "March 2026");
  for (const q of ["year=all", "year=2025", "year=2026&range=ytd", "year=2026&month=3"]) {
    const sel = parsePnlSelection(Object.fromEntries(new URLSearchParams(q)), TODAY);
    assert.equal(selectionQuery(sel), `?${q}`);
  }
});
