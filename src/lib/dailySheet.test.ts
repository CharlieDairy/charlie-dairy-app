import { test } from "node:test";
import assert from "node:assert/strict";
import { planNumbers, compareTags, rowTotal } from "./dailySheet";

test("a new number is created, a changed one is updated, an equal one is left alone", () => {
  const saved = new Map([
    ["a|MORNING", [{ id: "r1", value: 4.5 }]],
    ["b|MORNING", [{ id: "r2", value: 3 }]],
  ]);
  const wanted = new Map([
    ["a|MORNING", 4.5],
    ["b|MORNING", 3.4],
    ["c|MORNING", 2],
  ]);
  const plan = planNumbers(saved, wanted);
  assert.deepEqual(plan.create, ["c|MORNING"]);
  assert.deepEqual(plan.update, [{ id: "r2", key: "b|MORNING", value: 3.4 }]);
  assert.equal(plan.unchanged, 1);
  assert.deepEqual(plan.ambiguous, []);
});

test("saving the same sheet twice changes nothing", () => {
  const saved = new Map([["a", [{ id: "r1", value: 10 }]]]);
  const plan = planNumbers(saved, new Map([["a", 10]]));
  assert.equal(plan.create.length + plan.update.length + plan.ambiguous.length, 0);
  assert.equal(plan.unchanged, 1);
});

test("two saved rows for the same key are reported, not touched", () => {
  const saved = new Map([["city", [{ id: "x", value: 100 }, { id: "y", value: 100 }]]]);
  const plan = planNumbers(saved, new Map([["city", 104]]));
  assert.deepEqual(plan.ambiguous, ["city"]);
  assert.equal(plan.create.length + plan.update.length, 0);
});

test("a blank box (not in the map) never deletes or changes a saved row", () => {
  const saved = new Map([["a", [{ id: "r1", value: 10 }]]]);
  const plan = planNumbers(saved, new Map());
  assert.equal(plan.create.length + plan.update.length + plan.ambiguous.length + plan.unchanged, 0);
});

test("tags sort as numbers", () => {
  assert.deepEqual(["107", "47", "9", "50"].sort(compareTags), ["9", "47", "50", "107"]);
});

test("row totals ignore blanks", () => {
  assert.equal(rowTotal(["7.8", "5.2", "6.0"]), 19);
  assert.equal(rowTotal(["", null, "3.3"]), 3.3);
  assert.equal(rowTotal(["abc", "2"]), 2);
});
