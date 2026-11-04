import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSheetFill, litresText, SheetReadSchema, type SheetContext, type SheetRead } from "./sheetPhoto";

const ctx: SheetContext = {
  cows: [{ id: "c55", tag: "55" }, { id: "c7", tag: "7" }, { id: "cA", tag: "A12" }],
  customers: [{ id: "u1", name: "City Sale" }, { id: "u2", name: "Nawaz Khan" }, { id: "u3", name: "Hafiz Muneeb" }],
  feeds: [{ id: "f1", name: "Silage" }, { id: "f2", name: "Wenda" }, { id: "f3", name: "Turi" }],
  canFeed: true,
};
const empty: SheetRead = { date: "", milk: [], sold: [], used: [], feed: [], note: "", unclear: [] };
const read = (p: Partial<SheetRead>): SheetRead => ({ ...empty, ...p });

test("milk is filled for the right cow and session, with up to two decimals", () => {
  const r = buildSheetFill(read({ milk: [{ tag: "55", morning: 5.25, noon: null, evening: 4.5 }] }), ctx);
  assert.deepEqual(r.fills, { m_c55_M: "5.25", m_c55_E: "4.5" });
});

test("a tag is matched however it was written", () => {
  const r = buildSheetFill(read({ milk: [{ tag: "Tag # 055", morning: 3, noon: null, evening: null }, { tag: "a12", morning: 1, noon: null, evening: null }] }), ctx);
  assert.equal(r.fills.m_c55_M, "3");
  assert.equal(r.fills.m_cA_M, "1");
});

test("a tag that is not on the sheet is reported instead of being guessed", () => {
  const r = buildSheetFill(read({ milk: [{ tag: "99", morning: 5, noon: 5, evening: 5 }] }), ctx);
  assert.deepEqual(r.fills, {});
  assert.deepEqual(r.unmatched, ["Tag 99 is not on this sheet"]);
});

test("more than 2 decimals are rounded and impossible litres are dropped", () => {
  assert.equal(litresText(5.256), "5.26");
  assert.equal(litresText(-1), null);
  assert.equal(litresText(250), null); // a single milking is never 250 litres
  assert.equal(litresText(null), null);
  const r = buildSheetFill(read({ milk: [{ tag: "55", morning: 250, noon: 4.999, evening: -3 }] }), ctx);
  assert.deepEqual(r.fills, { m_c55_A: "5" });
});

test("a buyer is matched by name, also when only part of it was written", () => {
  const r = buildSheetFill(read({ sold: [{ buyer: "city sale", litres: 120 }, { buyer: "Nawaz", litres: 30.5 }] }), ctx);
  assert.deepEqual(r.fills, { sale_u1: "120", sale_u2: "30.5" });
});

test("a buyer name that fits two customers is not guessed", () => {
  const two: SheetContext = { ...ctx, customers: [{ id: "a", name: "Khan Dairy" }, { id: "b", name: "Khan Traders" }] };
  const r = buildSheetFill(read({ sold: [{ buyer: "Khan", litres: 10 }] }), two);
  assert.deepEqual(r.fills, {});
  assert.equal(r.unmatched.length, 1);
});

test("milk used is matched to calf, employee or farm use", () => {
  const r = buildSheetFill(read({ used: [{ kind: "Calves", litres: 12 }, { kind: "Employees", litres: 4 }, { kind: "Farm use", litres: 2 }] }), ctx);
  assert.deepEqual(r.fills, { use_CALF_USE: "12", use_EMPLOYEE_USE: "4", use_FARM_USE: "2" });
});

test("feed used and received are filled, and a zero is treated as nothing written", () => {
  const r = buildSheetFill(read({ feed: [{ name: "silage", used: 350, received: 0 }, { name: "Wenda", used: 2.5, received: 20 }] }), ctx);
  assert.deepEqual(r.fills, { out_f1: "350", out_f2: "2.5", in_f2: "20" });
});

test("feed is left out for someone who cannot record feed, and they are told", () => {
  const r = buildSheetFill(read({ feed: [{ name: "Silage", used: 350, received: null }] }), { ...ctx, canFeed: false });
  assert.deepEqual(r.fills, {});
  assert.match(r.unmatched[0], /cannot record feed/);
});

test("the note is kept, and anything the AI could not read is passed on", () => {
  const r = buildSheetFill(read({ note: "  AI of Tag 55  ", unclear: ["Tag 7 evening", ""] }), ctx);
  assert.equal(r.fills.note, "AI of Tag 55");
  assert.deepEqual(r.unmatched, ["Hard to read: Tag 7 evening"]);
});

test("the AI's answer is checked against the expected shape", () => {
  assert.equal(SheetReadSchema.safeParse(empty).success, true);
  assert.equal(SheetReadSchema.safeParse({ ...empty, milk: [{ tag: "5", morning: "five" }] }).success, false);
  assert.equal(SheetReadSchema.safeParse({ date: "2026-10-25" }).success, false);
});
