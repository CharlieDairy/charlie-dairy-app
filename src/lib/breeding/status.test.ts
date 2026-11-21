import { test } from "node:test";
import assert from "node:assert/strict";
import { breedingTag, countByCode, type BreedingInput } from "./status";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const TODAY = d("2026-11-21");
const cow = (o: Partial<BreedingInput> = {}): BreedingInput => ({
  gender: "FEMALE", status: "MILKING", dateOfBirth: null, expectedCalving: null, lastCalving: null, lastHeat: null, lastInsemination: null, lastCheck: null, ...o,
});
const code = (o: Partial<BreedingInput>) => breedingTag(cow(o), TODAY)?.code;

test("males, calves, sold and dead animals get no tag", () => {
  assert.equal(breedingTag(cow({ gender: "MALE" }), TODAY), null);
  assert.equal(breedingTag(cow({ status: "CALF" }), TODAY), null);
  assert.equal(breedingTag(cow({ status: "SOLD" }), TODAY), null);
  assert.equal(breedingTag(cow({ status: "DEAD" }), TODAY), null);
});

test("after calving she is 'Calved' until the waiting period ends, then waiting for heat", () => {
  assert.equal(code({ lastCalving: d("2026-11-01") }), "CALVED"); // 20 days
  assert.equal(code({ lastCalving: d("2026-09-22") }), "WAITING_FOR_HEAT"); // 60 days
  assert.equal(breedingTag(cow({ lastCalving: d("2026-09-22") }), TODAY)?.needsAction, true);
});

test("a heat seen today or yesterday means in heat; an old unserved heat is ignored", () => {
  assert.equal(code({ lastCalving: d("2026-08-01"), lastHeat: d("2026-11-21") }), "IN_HEAT");
  assert.equal(code({ lastCalving: d("2026-08-01"), lastHeat: d("2026-11-20") }), "IN_HEAT");
  assert.equal(code({ lastCalving: d("2026-08-01"), lastHeat: d("2026-11-10") }), "WAITING_FOR_HEAT");
});

test("insemination starts the 40 day clock: inseminated, check due on day 40, overdue from day 60", () => {
  assert.equal(code({ lastInsemination: d("2026-11-19") }), "INSEMINATED"); // day 2
  assert.equal(code({ lastInsemination: d("2026-10-13") }), "INSEMINATED"); // day 39
  assert.equal(code({ lastInsemination: d("2026-10-12") }), "CHECK_DUE"); // day 40
  assert.equal(code({ lastInsemination: d("2026-09-23") }), "CHECK_DUE"); // day 59
  assert.equal(code({ lastInsemination: d("2026-09-22") }), "CHECK_OVERDUE"); // day 60
  const t = breedingTag(cow({ lastInsemination: d("2026-10-12") }), TODAY)!;
  assert.equal(t.needsAction, true);
  assert.match(t.detail, /40 days since insemination/);
});

test("the insemination moves her on from calved: calved then inseminated", () => {
  assert.equal(code({ lastCalving: d("2026-08-01"), lastInsemination: d("2026-11-10") }), "INSEMINATED");
});

test("a pregnancy check decides the result: pregnant, or open and waiting for heat", () => {
  const ai = d("2026-09-01");
  assert.equal(code({ lastInsemination: ai, lastCheck: { date: d("2026-10-15"), result: "PREGNANT" }, expectedCalving: d("2027-06-08") }), "PREGNANT");
  assert.equal(code({ lastInsemination: ai, lastCheck: { date: d("2026-10-15"), result: "OPEN" } }), "OPEN");
  assert.equal(code({ lastInsemination: ai, lastCheck: { date: d("2026-10-15"), result: "INCONCLUSIVE" } }), "CHECK_DUE");
});

test("re-inseminating after an open check starts a new clock", () => {
  assert.equal(code({ lastInsemination: d("2026-11-19"), lastCheck: { date: d("2026-09-30"), result: "OPEN" } }), "INSEMINATED");
});

test("a pregnancy already recorded on the animal counts even without a check record", () => {
  assert.equal(code({ lastInsemination: d("2026-02-25"), expectedCalving: d("2026-12-05") }), "PREGNANT");
});

test("past the expected calving date she is due to calve", () => {
  assert.equal(code({ lastInsemination: d("2026-02-01"), lastCheck: { date: d("2026-04-01"), result: "PREGNANT" }, expectedCalving: d("2026-11-21") }), "DUE_TO_CALVE");
});

test("a calving after the pregnancy resets the cycle", () => {
  assert.equal(code({ lastInsemination: d("2026-02-01"), lastCheck: { date: d("2026-04-01"), result: "PREGNANT" }, lastCalving: d("2026-11-10") }), "CALVED");
});

test("heifers: not yet bred when young, waiting for heat from 15 months", () => {
  assert.equal(code({ status: "HEIFER", dateOfBirth: d("2026-01-01") }), "NOT_YET_BRED");
  assert.equal(code({ status: "HEIFER", dateOfBirth: d("2025-06-01") }), "WAITING_FOR_HEAT");
  assert.equal(code({ status: "HEIFER" }), "NOT_YET_BRED");
});

test("an adult cow with no records at all is waiting for heat; a dry one with none is left untagged", () => {
  assert.equal(code({ status: "MILKING" }), "WAITING_FOR_HEAT");
  assert.equal(breedingTag(cow({ status: "DRY" }), TODAY), null);
});

test("countByCode counts stages and ignores untagged animals", () => {
  const tags = [breedingTag(cow({ lastInsemination: d("2026-11-19") }), TODAY), breedingTag(cow({ lastInsemination: d("2026-11-18") }), TODAY), null, breedingTag(cow({ status: "MILKING" }), TODAY)];
  assert.deepEqual(countByCode(tags), { INSEMINATED: 2, WAITING_FOR_HEAT: 1 });
});
