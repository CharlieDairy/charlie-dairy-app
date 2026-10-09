import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyCash, netOf } from "./cashClass";

const c = (category: string, amountIn: number, amountOut: number, remark = "", accountClass?: string) => classifyCash({ category, amountIn, amountOut, remark, accountClass });

test("milk receipts are sales, whether from the cash book or a recorded customer payment", () => {
  assert.equal(c("Cash sale proceed for Milk", 51020, 0, "Nawaz Khan milk Bill"), "MILK_SALES");
  assert.equal(c("Milk Sale Payment", 5000, 0), "MILK_SALES");
});

test("money from the company / partners is capital, not revenue", () => {
  assert.equal(c("Cash from Company", 50000, 0, "Cash from Hafiz sb"), "PARTNER_IN");
});

test("animal and calf sales are their own income line", () => {
  assert.equal(c("Cash sale proceed for Cows", 400000, 0, "Tag 47 sale"), "LIVESTOCK_SALES");
  assert.equal(c("Cash sale proceed for Calves", 23000, 0), "LIVESTOCK_SALES");
});

test("sale proceeds sent on to the owner are a partner withdrawal, not a negative sale", () => {
  assert.equal(c("Cash sale proceed for Cows", 0, 625700, "Animal sale Total Remaining Amount Transferred to Abid sb"), "PARTNER_OUT");
  assert.equal(c("Cash sale proceed for Calves", 0, 690000, "Female calf's payment Transfer to Abid sb"), "PARTNER_OUT");
  assert.equal(c("Uncategorized", 0, 400000, "Tag 102 sale payment 400k send to Abid sb Account"), "PARTNER_OUT");
});

test("a 'wrong entry' reversal takes the class of what it reverses, so the pair cancels", () => {
  assert.equal(c("Cash sale proceed for Milk", 0, 480901, "Wrong Entry Cash received milk sale 30 & 31-01-26"), "MILK_SALES");
  assert.equal(c("Uncategorized", 0, 45400, "Wrong Entery as cash In Sailage unloading expence etc"), "OPEX");
});

test("capital spending is kept out of operating cost", () => {
  assert.equal(c("CAPEX", 0, 9000, "Sand 2 Trali"), "CAPEX");
});

test("operating costs", () => {
  for (const cat of ["Opex Feed", "Opex", "Opex Fuel", "Opex Medical", "Opex Salaries", "Advance Salary", "Feed supliment", "A.I", "Vaccination", "Agri Land lease"]) assert.equal(c(cat, 0, 1000), "OPEX", cat);
});

test("uncategorized: money out counts as a cost, money in waits for review unless it is clearly milk", () => {
  assert.equal(c("Uncategorized", 0, 15500, "Milk chiller Repair"), "OPEX");
  assert.equal(c("Uncategorized", 2700, 0, "Milk sale at farm"), "MILK_SALES");
  assert.equal(c("Uncategorized", 1000, 0, "something"), "REVIEW");
});

test("an unseen category is a cost if money went out, otherwise needs review", () => {
  assert.equal(c("Zakat", 0, 5000), "OPEX");
  assert.equal(c("Gift received", 5000, 0), "REVIEW");
});

test("an Admin override always wins", () => {
  assert.equal(c("Cash from Company", 100, 0, "", "OTHER_INCOME"), "OTHER_INCOME");
  assert.equal(c("Opex", 0, 100, "", "CAPEX"), "CAPEX");
});

test("netOf: income counts in minus out, costs count out minus in", () => {
  assert.equal(netOf("MILK_SALES", 1000, 0), 1000);
  assert.equal(netOf("MILK_SALES", 0, 480901), -480901);
  assert.equal(netOf("OPEX", 45400, 0), -45400);
  assert.equal(netOf("OPEX", 0, 5000), 5000);
});
