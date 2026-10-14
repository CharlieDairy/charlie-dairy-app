import test from "node:test";
import assert from "node:assert/strict";
import { extractTags, mentionsTag, extractSoldTags, extractMotherTags } from "./tagMatch";

test("a single tag", () => {
  assert.deepEqual(extractTags("Semen for Tag 56"), ["56"]);
  assert.deepEqual(extractTags("AI of Tag 106 sexed seamon on 20-02-25"), ["106"]);
});

test("several tags in one entry", () => {
  assert.deepEqual(extractTags("Tag 111,114,117 Heifers sale Tag 36 sale but payment 380k is pending").sort(), ["111", "114", "117", "36"]);
  assert.deepEqual(extractTags("Medicine for Tag 50 and Tag 119").sort(), ["119", "50"]);
  assert.deepEqual(extractTags("Male calf sale Tag 118, 128 & 131").sort(), ["118", "128", "131"]);
  assert.deepEqual(extractTags("Cash Recived male calf sale Tag 109 & 112 @ 100k").sort(), ["109", "112"]);
});

test("amounts and dates are not tags", () => {
  assert.deepEqual(extractTags("Cash received 50000 on 12-03-25"), []);
  assert.deepEqual(extractTags(null), []);
});

test("matching is exact", () => {
  assert.equal(mentionsTag("Semen for Tag 56", "56"), true);
  assert.equal(mentionsTag("Semen for Tag 56", "5"), false);
  assert.equal(mentionsTag("Semen for Tag 56", "560"), false);
  assert.equal(mentionsTag("Seamon for Tag H-12", "h-12"), true);
});

test("a sale names the animal sold, not its mother", () => {
  const r = "Cash Recived Male calf (Tag 137) sale Mother Tag 47 02-09-26";
  assert.deepEqual(extractSoldTags(r), ["137"]);
  assert.deepEqual(extractMotherTags(r), ["47"]);
  assert.deepEqual(extractSoldTags("Tag 19, Tag 58 & Tag 101 sold"), ["19", "58", "101"]);
});
