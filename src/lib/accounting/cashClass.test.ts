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

test("bank book: Engro milk receipts are milk sales, incentives too", () => {
  assert.equal(c("SALE", 150366, 0, "Milk Collection from Engro"), "MILK_SALES");
  assert.equal(c("MILK", 181747, 0, "Milk sale engro"), "MILK_SALES");
  assert.equal(c("SALE", 13224, 0, "LOYALTY INCENTIVE"), "MILK_SALES");
  assert.equal(c("SALE", 170638, 0, ""), "MILK_SALES");
});

test("bank book: transfers to the farm manager's petty cash are transfers, not costs or capital", () => {
  assert.equal(c("Bank", 0, 162880, "Trf to AB for Jan Exp"), "TRANSFER");
  assert.equal(c("Bank", 0, 151058, "Trf to Abdul Baist"), "TRANSFER");
  assert.equal(c("Bank", 0, 81046, "Cash trf to A Basit"), "TRANSFER");
  assert.equal(c("Ops", 0, 50050, "Petty Cash to AB"), "TRANSFER");
  assert.equal(c("Bank", 0, 130000, "Petty Cash to AB"), "TRANSFER");
});

test("bank book: cash a partner takes from the bank is a partner withdrawal", () => {
  assert.equal(c("Bank", 0, 210000, "Cash by Hafiz"), "PARTNER_OUT");
  assert.equal(c("Bank", 0, 36911, "final settlement of Hafiz shab"), "PARTNER_OUT");
});

test("bank book: partner deposits, Phase III and capital", () => {
  assert.equal(c("Bank", 464485, 0, "Trf from Abid Sheikh"), "PARTNER_IN");
  assert.equal(c("Investment PhIII", 99413, 0, "Capital from Farhan ul Haq"), "PARTNER_IN");
  assert.equal(c("Investment PhIII", 0, 99000, "Capital return to Junaid Bhai"), "PARTNER_OUT");
  assert.equal(c("PHASE 3", 0, 3000000, "2nd Payment of Cows"), "CAPEX");
  assert.equal(c("PHASE 3", 600000, 0, "Junaid and Mohsin Deposit"), "PARTNER_IN");
  assert.equal(c("Bank", 0, 250000, "To SK Industries on accunt of Land Payment"), "CAPEX");
});

test("bank book: a cow sale and the salary, accounting and silage payments", () => {
  assert.equal(c("Bank", 153000, 0, "Proceeds from Cow sale"), "LIVESTOCK_SALES");
  assert.equal(c("Bank", 0, 15000, "Taha Feb Salary"), "OPEX");
  assert.equal(c("", 0, 60000, "payment to Taha Amir for Accounting service"), "OPEX");
  assert.equal(c("Ops", 0, 364385, "Silage Payment"), "OPEX");
});

test("petty-cash behaviour is unchanged by the bank rules", () => {
  assert.equal(c("Cash from Company", 100000, 0, "Cash by Hafiz sb"), "PARTNER_IN");
  assert.equal(c("Opex Feed", 0, 60000, "Transfer to Agri Expence book For Fodder etc"), "OPEX");
  assert.equal(c("Cash sale proceed for Milk", 62020, 0, "Cash Recived milk sale 01-09-26 to 04-09-26"), "MILK_SALES");
});
