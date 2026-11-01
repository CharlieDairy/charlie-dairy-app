import { test } from "node:test";
import assert from "node:assert/strict";
import { deleteConfirm } from "./deleteConfirm";

test("the Admin is warned that a delete cannot be undone", () => {
  assert.equal(deleteConfirm(false, "this sale entry"), "Delete this sale entry? This can't be undone.");
});

test("the farm manager is told it only sends a request until the Admin approves", () => {
  const t = deleteConfirm(true, "this sale entry");
  assert.match(t, /^Ask the Admin to delete this sale entry\?/);
  assert.match(t, /Nothing is removed until the Admin approves it\./);
  assert.doesNotMatch(t, /can't be undone/);
});

test("an extra sentence is added after the question for both roles", () => {
  assert.match(deleteConfirm(false, "the payment", "Its Cash Register entry is removed too."), /undone\. Its Cash Register entry is removed too\.$/);
  assert.match(deleteConfirm(true, "the payment", "Its Cash Register entry is removed too."), /approves it\. Its Cash Register entry is removed too\.$/);
});
