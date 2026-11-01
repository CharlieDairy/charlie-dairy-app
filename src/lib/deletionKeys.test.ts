import { test } from "node:test";
import assert from "node:assert/strict";
import { milkingKey, parseMilkingKey } from "./deletionKeys";

test("a cow's milk record key reads back to the same cow and day", () => {
  const k = parseMilkingKey(milkingKey("cow123", "2026-10-25"));
  assert.equal(k?.cowId, "cow123");
  assert.equal(k?.date.toISOString(), "2026-10-25T00:00:00.000Z");
});

test("a herd total (no cow) has a blank cow part and reads back as no cow", () => {
  assert.equal(milkingKey(null, "2026-10-25"), "|2026-10-25");
  assert.equal(parseMilkingKey("|2026-10-25")?.cowId, null);
});

test("a key with a bad or missing date is refused, so nothing is deleted by mistake", () => {
  assert.equal(parseMilkingKey("cow123|"), null);
  assert.equal(parseMilkingKey("cow123|25-10-2026"), null);
  assert.equal(parseMilkingKey("cow123"), null);
  assert.equal(parseMilkingKey(""), null);
});
