import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNotice, countByDay, farmDayOfInstant, farmDayRange, lastDays, validFarmDay } from "./dailyActivity";

test("a farm day runs 00:00 to 24:00 Pakistan time, which is 19:00 to 19:00 UTC", () => {
  const { start, end } = farmDayRange("2026-11-19");
  assert.equal(start.toISOString(), "2026-11-18T19:00:00.000Z");
  assert.equal(end.toISOString(), "2026-11-19T19:00:00.000Z");
});

test("an entry made at 11:30 pm in Pakistan belongs to that day, one at 00:10 am to the next", () => {
  assert.equal(farmDayOfInstant(new Date("2026-11-19T18:30:00Z")), "2026-11-19");
  assert.equal(farmDayOfInstant(new Date("2026-11-19T19:10:00Z")), "2026-11-20");
});

test("lastDays lists today first and walks back across a month end", () => {
  assert.deepEqual(lastDays("2026-12-02", 4), ["2026-12-02", "2026-12-01", "2026-11-30", "2026-11-29"]);
});

test("countByDay buckets by farm day", () => {
  const m = countByDay([new Date("2026-11-19T04:00:00Z"), new Date("2026-11-19T18:59:00Z"), new Date("2026-11-19T19:00:00Z")]);
  assert.equal(m.get("2026-11-19"), 2);
  assert.equal(m.get("2026-11-20"), 1);
});

test("the notice lists finished days with entries that are not reviewed, and today's count separately", () => {
  const totals = new Map([["2026-11-20", 7], ["2026-11-19", 30], ["2026-11-18", 12], ["2026-11-16", 5]]);
  const n = buildNotice("2026-11-20", totals, new Set(["2026-11-18"]), 14);
  assert.deepEqual(n.pastDays, [{ day: "2026-11-19", total: 30 }, { day: "2026-11-16", total: 5 }]);
  assert.equal(n.today, 7);
});

test("today is never listed as reviewable, and days with no entries are not notified", () => {
  const n = buildNotice("2026-11-20", new Map([["2026-11-20", 3]]), new Set(), 14);
  assert.deepEqual(n.pastDays, []);
  assert.equal(n.today, 3);
});

test("days older than the window are not listed", () => {
  const n = buildNotice("2026-11-20", new Map([["2026-10-01", 9]]), new Set(), 14);
  assert.deepEqual(n.pastDays, []);
});

test("validFarmDay accepts real dates only", () => {
  assert.equal(validFarmDay("2026-11-19"), "2026-11-19");
  assert.equal(validFarmDay("2026-02-30"), null);
  assert.equal(validFarmDay("19-11-2026"), null);
  assert.equal(validFarmDay(undefined), null);
});
