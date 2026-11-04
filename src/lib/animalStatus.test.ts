import { test } from "node:test";
import assert from "node:assert/strict";
import { watermarkFor } from "./animalStatus";

test("a sold animal is stamped SOLD and a dead one DEAD", () => {
  assert.deepEqual(watermarkFor("SOLD"), { text: "SOLD", tone: "sold" });
  assert.deepEqual(watermarkFor("DEAD"), { text: "DEAD", tone: "dead" });
});

test("an animal still in the herd has no stamp, so setting it back removes it", () => {
  for (const s of ["MILKING", "DRY", "HEIFER", "CALF", "INSEMINATED"]) assert.equal(watermarkFor(s), null, s);
});

test("the status is matched whatever its case, and missing statuses are safe", () => {
  assert.equal(watermarkFor("sold")?.text, "SOLD");
  assert.equal(watermarkFor("Dead")?.text, "DEAD");
  assert.equal(watermarkFor("death")?.text, "DEAD");
  assert.equal(watermarkFor(null), null);
  assert.equal(watermarkFor(undefined), null);
  assert.equal(watermarkFor(""), null);
});
