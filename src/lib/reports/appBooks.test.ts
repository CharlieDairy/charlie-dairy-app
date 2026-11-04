import { test } from "node:test";
import assert from "node:assert/strict";
import { coveredByApp } from "./appBooks";

const books = { cutover: new Date("2026-09-01T00:00:00Z"), paymentCashIds: new Set(["pay1"]) };
const row = (o: Partial<{ id: string; date: string; category: string }>) => ({ id: o.id ?? "x", date: new Date(`${o.date ?? "2026-10-05"}T00:00:00Z`), category: o.category ?? "Opex" });

test("a customer payment is skipped after the cutover, because the sale was already counted when billed", () => {
  assert.equal(coveredByApp(books, row({ id: "pay1" }), "MILK_SALES"), true);
});

test("a milk receipt that is not a customer payment is still counted", () => {
  assert.equal(coveredByApp(books, row({ id: "direct" }), "MILK_SALES"), false);
});

test("feed purchases are skipped after the cutover, other costs are kept", () => {
  assert.equal(coveredByApp(books, row({ category: "Opex Feed" }), "OPEX"), true);
  assert.equal(coveredByApp(books, row({ category: "Feed supliment" }), "OPEX"), true);
  assert.equal(coveredByApp(books, row({ category: "Advance Salary" }), "OPEX"), false);
  assert.equal(coveredByApp(books, row({ category: "Opex Fuel" }), "OPEX"), false);
});

test("nothing before the cutover changes, and nothing changes when there is no cutover", () => {
  assert.equal(coveredByApp(books, row({ id: "pay1", date: "2026-08-31" }), "MILK_SALES"), false);
  assert.equal(coveredByApp(books, row({ category: "Opex Feed", date: "2026-08-31" }), "OPEX"), false);
  assert.equal(coveredByApp({ cutover: null, paymentCashIds: new Set(["pay1"]) }, row({ id: "pay1" }), "MILK_SALES"), false);
});

test("animal sales and other classes are never skipped", () => {
  assert.equal(coveredByApp(books, row({ category: "Cash sale proceed for Cows" }), "LIVESTOCK_SALES"), false);
  assert.equal(coveredByApp(books, row({ category: "Opex Feed" }), "CAPEX"), false);
});
