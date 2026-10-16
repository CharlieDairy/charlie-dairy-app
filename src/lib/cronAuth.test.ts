import test from "node:test";
import assert from "node:assert/strict";
import { isAuthorisedCron } from "./cronAuth";

const SECRET = "a-long-random-secret-123456";
const req = (auth?: string) => new Request("https://example.test/api/cron/backup", { headers: auth ? { authorization: auth } : {} });

test("accepts the exact bearer secret", () => {
  assert.equal(isAuthorisedCron(req(`Bearer ${SECRET}`), SECRET), true);
});

test("refuses a wrong, missing or malformed secret", () => {
  assert.equal(isAuthorisedCron(req("Bearer wrong-secret-0000000000"), SECRET), false);
  assert.equal(isAuthorisedCron(req(), SECRET), false);
  assert.equal(isAuthorisedCron(req(SECRET), SECRET), false);
});

test("refuses everything when the secret is not set or too short", () => {
  assert.equal(isAuthorisedCron(req("Bearer "), undefined), false);
  assert.equal(isAuthorisedCron(req("Bearer short"), "short"), false);
  assert.equal(isAuthorisedCron(req("Bearer "), ""), false);
});
