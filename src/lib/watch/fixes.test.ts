import { test } from "node:test";
import assert from "node:assert/strict";
import { fixLinks, fixesForRole } from "./fixes";

test("a missing-days finding links to the Daily Record Sheet for each missing day", () => {
  const links = fixLinks({ ruleId: "milk.missing-days", key: "milk.missing-days", metric: { missingDates: ["2026-10-24", "2026-10-28", "bad", 5] } });
  assert.deepEqual(links.map((l) => l.href), ["/entry/daily?date=2026-10-24", "/entry/daily?date=2026-10-28"]);
});

test("an uncosted-feed finding links to each feed's entries", () => {
  const links = fixLinks({ ruleId: "feed.uncosted", key: "feed.uncosted", metric: { feeds: [{ feed: "Wenda" }, { feed: "Wheat Straw" }] } });
  assert.deepEqual(links.map((l) => l.href), ["/admin/reports/feed?feed=Wenda", "/admin/reports/feed?feed=Wheat%20Straw"]);
});

test("an outlier finding links to the milking day of each record, and survives missing metric data", () => {
  const links = fixLinks({ ruleId: "milk.outlier", key: "milk.outlier", metric: { records: [{ tag: "47", date: "2026-10-20" }] } });
  assert.equal(links[0].href, "/entry/milking?date=2026-10-20");
  assert.equal(fixLinks({ ruleId: "milk.outlier", key: "milk.outlier", metric: null })[0].href, "/entry/milking");
});

test("an unknown rule has no fix links and does not throw", () => {
  assert.deepEqual(fixLinks({ ruleId: "something.new", key: "x", metric: undefined }), []);
});

test("the farm manager (Editor) gets entry pages, and is told to ask the Admin for finance statements", () => {
  const entry = fixesForRole({ ruleId: "milk.missing-days", key: "k", metric: { missingDates: ["2026-10-24"] } }, "EDITOR");
  assert.equal(entry.open.length, 1);
  assert.equal(entry.adminOnly, 0);
  const books = fixesForRole({ ruleId: "acct.balance-sheet", key: "k", metric: null }, "EDITOR");
  assert.deepEqual(books.open.map((l) => l.href), ["/admin/reports/cash-register"]);
  assert.equal(books.adminOnly, 1);
});

test("a purchase-without-a-rate finding links to each feed's ledger for the last year", () => {
  const links = fixLinks({ ruleId: "feed.unrated-receipts", key: "k", metric: { feeds: [{ feed: "Silage" }, { feed: "Wheat Straw" }] } });
  assert.equal(links.length, 2);
  assert.match(links[0].href, /^\/admin\/reports\/feed\?feed=Silage&period=custom&from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/);
  assert.match(links[1].href, /feed=Wheat%20Straw/);
});

test("the Admin can open every fix", () => {
  const books = fixesForRole({ ruleId: "acct.balance-sheet", key: "k", metric: null }, "ADMIN");
  assert.equal(books.open.length, 2);
  assert.equal(books.adminOnly, 0);
});
