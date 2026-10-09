import test from "node:test";
import assert from "node:assert/strict";
import { roleCanOpenPath, homeFor } from "./modules";

const ADMIN_PANEL = ["/admin/users", "/admin/master-data", "/admin/bulk", "/admin/audit-log"];
const STATEMENTS = ["/admin/reports/pl", "/admin/reports/balance-sheet", "/admin/reports/cashflow", "/admin/capital", "/admin/assets"];

test("Admin opens everything", () => {
  for (const p of [...ADMIN_PANEL, ...STATEMENTS, "/entry/cash"]) assert.equal(roleCanOpenPath("ADMIN", p), true, p);
});

test("Editor and View Only are shut out of the Admin panel and the finance statements", () => {
  for (const role of ["EDITOR", "VIEWER"]) for (const p of [...ADMIN_PANEL, ...STATEMENTS]) assert.equal(roleCanOpenPath(role, p), false, `${role} ${p}`);
});

test("View Only cannot open data-entry pages, Editor can", () => {
  assert.equal(roleCanOpenPath("VIEWER", "/entry/cash"), false);
  assert.equal(roleCanOpenPath("EDITOR", "/entry/cash"), true);
});

test("Partner reads everything except the Admin panel and cannot open data-entry pages", () => {
  for (const p of STATEMENTS) assert.equal(roleCanOpenPath("PARTNER", p), true, p);
  for (const p of ADMIN_PANEL) assert.equal(roleCanOpenPath("PARTNER", p), false, p);
  for (const p of ["/admin/reports/cash-register", "/admin/cows", "/admin/reports/milk-sales", "/admin/watch"]) assert.equal(roleCanOpenPath("PARTNER", p), true, p);
  assert.equal(roleCanOpenPath("PARTNER", "/entry/cash"), false);
  assert.equal(roleCanOpenPath("PARTNER", "/admin/cows/add"), false);
});

test("Partners land on the dashboard", () => {
  assert.equal(homeFor("PARTNER"), "/admin");
});
