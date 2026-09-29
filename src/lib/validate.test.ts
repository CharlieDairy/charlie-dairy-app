import test from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "./errors";
import { parseNumber, parseDateValue, reqNum, optNum, reqDate, reqEnum, reqText, optText, reqId } from "./validate";

const form = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};
const rejects = (fn: () => unknown, re?: RegExp) => assert.throws(fn, (e) => e instanceof ValidationError && (!re || re.test(e.message)));

test("numbers: strict parsing rejects junk that parseFloat would accept", () => {
  assert.equal(parseNumber("12.5", "Litres"), 12.5);
  assert.equal(parseNumber(" 1,250.756 ", "Amount"), 1250.76); // commas stripped, 2-decimal rounding
  rejects(() => parseNumber("12abc", "Litres"), /must be a number/);
  rejects(() => parseNumber("1e9", "Litres"), /must be a number/);
  rejects(() => parseNumber("Infinity", "Litres"));
  rejects(() => parseNumber("", "Litres"));
});

test("numbers: range rules", () => {
  rejects(() => parseNumber("-1", "Litres"), /less than/);
  assert.equal(parseNumber("0", "Litres"), 0);
  rejects(() => parseNumber("0", "Amount", { positive: true }), /greater than zero/);
  rejects(() => parseNumber("201", "Litres", { max: 200 }), /more than/);
  assert.equal(parseNumber("7.6", "Age", { decimals: 0 }), 8);
});

test("required / optional numbers read from a form", () => {
  assert.equal(reqNum(form({ a: "5" }), "a", "A"), 5);
  rejects(() => reqNum(form({}), "a", "A"), /required/);
  assert.equal(optNum(form({ a: "  " }), "a", "A"), null);
  assert.equal(optNum(form({ a: "3" }), "a", "A"), 3);
});

test("dates: real calendar dates only", () => {
  assert.equal(parseDateValue("2026-02-28", "Date").toISOString(), "2026-02-28T00:00:00.000Z");
  rejects(() => parseDateValue("2026-02-30", "Date"), /real calendar date/);
  rejects(() => parseDateValue("garbage", "Date"), /valid date/);
  rejects(() => parseDateValue("3/4/2026", "Date"), /valid date/);
  rejects(() => parseDateValue("1999-12-31", "Date"), /too far in the past/);
});

test("dates: future dates are rejected unless allowed", () => {
  const nextYear = `${new Date().getUTCFullYear() + 1}-06-15`;
  rejects(() => parseDateValue(nextYear, "Date"), /future/);
  assert.ok(parseDateValue(nextYear, "Due", { futureDays: 800 }));
  // "today" in any timezone must be accepted
  assert.ok(parseDateValue(new Date().toISOString().slice(0, 10), "Date"));
  // datetime-local values (heat detection)
  assert.ok(parseDateValue(new Date().toISOString().slice(0, 16), "When"));
  assert.ok(reqDate(form({ d: "2026-01-05" }), "d", "D"));
});

test("enums, text and ids", () => {
  assert.equal(reqEnum(form({ s: "MORNING" }), "s", "Shift", ["MORNING", "EVENING"] as const), "MORNING");
  rejects(() => reqEnum(form({ s: "NOON" }), "s", "Shift", ["MORNING", "EVENING"] as const), /allowed choices/);
  rejects(() => reqEnum(form({}), "s", "Shift", ["MORNING"] as const), /required/);
  assert.equal(reqText(form({ t: "  hello " }), "t", "T"), "hello");
  rejects(() => reqText(form({ t: "x".repeat(101) }), "t", "T", { max: 100 }), /too long/);
  assert.equal(optText(form({}), "t", "T"), null);
  assert.equal(reqId(form({ id: "cm1abc_-9" }), "id", "Id"), "cm1abc_-9");
  rejects(() => reqId(form({ id: "a b; drop" }), "id", "Id"));
});
