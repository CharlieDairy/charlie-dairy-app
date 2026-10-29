// Daily "Charlie Farm - Milk Record" sheets, 1-21 Oct 2026.
// Adds only what is missing: milk sales, milk usage, feed issues, the Wheat Straw item, the sale of tag 56 + calf 140.
// Dry run by default; add --apply to write. Safe to re-run. Never deletes. Back up first: node scripts/backup-daily.js
const { PrismaClient } = require("@prisma/client");
const APPLY = process.argv.includes("--apply");
const BY = "Register import (milk sheets, 29 Oct 2026)";
const p = new PrismaClient();
const day = (n) => new Date(Date.UTC(2026, 9, n));
const iso = (x) => x.toISOString().slice(0, 10);
const say = (s) => console.log(s);
const run = async (fn) => { if (APPLY) await fn(); };

// date: [city, farm, calves, nawaz, hafiz, mehtab, abdur, labour, misc]  (litres, as written on the sheet)
const SHEET = {
  1: [104, 2, 30, 4, 0, 3, 1, 6, 2], 2: [103, 1.5, 30, 4, 0, 0, 1, 6, 2], 3: [110, 1, 30, 4, 0, 0, 1, 6, 2],
  4: [110, 2, 30, 4, 9, 0, 1, 6, 2], 5: [106, 1.5, 30, 4, 0, 0, 1, 6, 2], 6: [110, 1, 30, 4, 0, 0, 1, 6, 2],
  7: [114, 1.5, 30, 4, 0, 0, 1, 6, 2], 8: [110, 2, 30, 4, 0, 0, 1, 6, 2], 9: [117, 2, 30, 4, 0, 0, 1, 6, 2],
  10: [116, 1.5, 30, 4, 2, 0, 1, 6, 2], 11: [110, 1.5, 30, 4.5, 0, 0, 1, 6, 2], 12: [105, 2, 30, 4, 0, 0, 1, 6, 2], 13: [110, 1.5, 30, 4.5, 0, 0, 1, 6, 2],
  14: [103, 2, 30, 4.5, 8, 0, 1, 6, 2], 15: [107, 1.5, 30, 4.5, 0, 0, 1, 6, 2], 16: [112, 2, 36, 4.5, 0, 0, 1, 6, 2],
  17: [110, 1.5, 36, 4.5, 0, 0, 2, 6, 2], 18: [118, 2, 36, 4.5, 0, 0, 2, 6, 2], 19: [121, 2, 36, 4.5, 7, 0, 2, 6, 2],
  20: [120, 2, 36, 4.5, 0, 0, 2, 6, 2], 21: [131, 1.5, 34, 4.5, 0, 0, 1, 6, 2],
  22: [120, 2, 30, 4.5, 11, 0, 1, 6, 2], 23: [104, 0, 30, 4.5, 0, 0, 1, 6, 2], 25: [102, 1.5, 30, 4.5, 0, 0, 1, 6, 2],
  26: [102, 1, 30, 4.5, 4, 0, 1, 6, 2], 27: [114, 1.5, 27, 4.5, 0, 0, 1, 6, 2],
};
const BUYERS = [["City Sale", 0, 155], ["Farm Sale", 1, 180], ["Nawaz Khan", 3, 180], ["Hafiz Muneeb", 4, 150], ["Mehtab", 5, 170], ["Abdur Rasheed", 6, 120]];
// Wheat straw used per day (closing stock on the sheet falls by this much). 1 Oct: 10,150 -> 10,100.
const STRAW = { 1: 50, 2: 70, 3: 80, 4: 100, 5: 100, 6: 100, 7: 80, 8: 80, 9: 80, 10: 80, 11: 80, 12: 80, 13: 80, 14: 80, 15: 80, 16: 80, 17: 80, 18: 80, 19: 80, 20: 80, 21: 100 };

(async () => {
  let n = { sale: 0, use: 0, feed: 0 };
  // 1. milk sales: add a buyer's litres for a date only when that buyer has no row that day
  for (const [d, row] of Object.entries(SHEET)) {
    for (const [buyer, i, rate] of BUYERS) {
      const litres = row[i]; if (!litres) continue;
      if (await p.milkSale.findFirst({ where: { date: day(+d), buyer } })) continue;
      say(`sale  ${iso(day(+d))} ${buyer} ${litres} L @ ${rate}`); n.sale++;
      await run(() => p.milkSale.create({ data: { date: day(+d), buyer, litres, rate, amount: Math.round(litres * rate), enteredBy: BY } }));
    }
    // 2. milk usage: calves, farm labour (employees), miscellaneous (farm use)
    for (const [type, litres] of [["CALF_USE", row[2]], ["EMPLOYEE_USE", row[7]], ["FARM_USE", row[8]]]) {
      if (await p.milkUsageRecord.findFirst({ where: { date: day(+d), type } })) continue;
      say(`usage ${iso(day(+d))} ${type} ${litres} L`); n.use++;
      await run(() => p.milkUsageRecord.create({ data: { date: day(+d), type, litres, enteredBy: BY } }));
    }
  }

  // 3. silage entered as "IN" on days the sheet shows it being fed out (4, 13, 19 Oct): turn into OUT
  for (const d of [4, 13, 19]) {
    const wrong = await p.feedTransaction.findFirst({ where: { date: day(d), feedType: "Silage", direction: "IN" } });
    const has = await p.feedTransaction.findFirst({ where: { date: day(d), feedType: "Silage", direction: "OUT" } });
    if (wrong && !has) { say(`feed  ${iso(day(d))} Silage ${wrong.quantity}: IN -> OUT (the sheet shows it fed out, no purchase)`); n.feed++; await run(() => p.feedTransaction.update({ where: { id: wrong.id }, data: { direction: "OUT", notes: ((wrong.notes || "") + " Direction corrected from IN to OUT per milk sheet (29 Oct 2026).").trim() } })); }
  }
  // 4. silage and wenda used on 20 and 21 Oct
  for (const [d, type, q] of [[20, "Silage", 400], [21, "Silage", 400], [20, "Wenda", 3], [21, "Wenda", 2.5]]) {
    if (await p.feedTransaction.findFirst({ where: { date: day(d), feedType: type, direction: "OUT" } })) continue;
    say(`feed  ${iso(day(d))} ${type} OUT ${q}`); n.feed++;
    await run(() => p.feedTransaction.create({ data: { date: day(d), feedType: type, direction: "OUT", quantity: q, enteredBy: BY } }));
  }

  // 5. Wheat Straw: new feed type and item, opening stock and daily use
  if (!(await p.masterDataItem.findFirst({ where: { category: "FEED_TYPE", code: "Wheat Straw" } }))) { say("master FEED_TYPE Wheat Straw"); await run(() => p.masterDataItem.create({ data: { category: "FEED_TYPE", code: "Wheat Straw", label: "Wheat Straw", sortOrder: 4 } })); }
  if (!(await p.feedItem.findUnique({ where: { name: "Wheat Straw" } }))) { say("feed item Wheat Straw (kg)"); await run(() => p.feedItem.create({ data: { name: "Wheat Straw", unit: "kg" } })); }
  if (!(await p.feedTransaction.findFirst({ where: { feedType: "Wheat Straw" } }))) {
    say("feed  2026-09-30 Wheat Straw IN 10150 (opening stock on the 1 Oct sheet)"); n.feed++;
    await run(() => p.feedTransaction.create({ data: { date: new Date(Date.UTC(2026, 8, 30)), feedType: "Wheat Straw", direction: "IN", quantity: 10150, notes: "Opening stock per milk sheet of 1 Oct 2026", enteredBy: BY } }));
    for (const [d, q] of Object.entries(STRAW)) { n.feed++; await run(() => p.feedTransaction.create({ data: { date: day(+d), feedType: "Wheat Straw", direction: "OUT", quantity: q, notes: null, enteredBy: BY } })); }
    say(`feed  Wheat Straw OUT 1-21 Oct, ${Object.values(STRAW).reduce((a, b) => a + b, 0)} kg in all (closing stock 8,430 kg)`);
  }

  // 6. tag 56 and her calf 140 sold together on 21 Oct for Rs 580,000
  const note = "Sold on 2026-10-21 together with her female calf (Tag 140 / Tag 56) for Rs 580,000 in all (milk sheet of 21 Oct). Buyer and payment not yet recorded.";
  for (const tag of ["56", "140"]) {
    const c = await p.cow.findFirst({ where: { tag } });
    if (!c || c.status === "SOLD") continue;
    say(`cow   tag ${tag}: ${c.status} -> SOLD`);
    await run(() => p.cow.update({ where: { id: c.id }, data: { status: "SOLD", notes: ((c.notes || "") + "; " + note).replace(/^; /, "") } }));
  }

  // 7. sheets of 22-27 Oct. The 24 Oct page was not photographed: its feed use is worked out from the opening stock on 25 Oct.
  const feed = async (d, type, direction, quantity, extra = {}) => {
    if (await p.feedTransaction.findFirst({ where: { date: day(d), feedType: type, direction } })) return;
    say(`feed  ${iso(day(d))} ${type} ${direction} ${quantity}`); n.feed++;
    await run(() => p.feedTransaction.create({ data: { date: day(d), feedType: type, direction, quantity, enteredBy: BY, ...extra } }));
  };
  const USE = { 22: [450, 2.5, 100], 23: [400, 2.5, 100], 24: [350, 2.5, 80], 25: [350, 2.5, 80], 26: [350, 3, 100], 27: [350, 2.5, 100] }; // silage, wenda, wheat straw
  for (const [d, [si, we, ws]] of Object.entries(USE)) {
    const x = +d === 24 ? { notes: "Worked out from the 25 Oct opening (no sheet for 24 Oct)" } : {};
    await feed(+d, "Silage", "OUT", si, x); await feed(+d, "Wenda", "OUT", we, x); await feed(+d, "Wheat Straw", "OUT", ws, x);
  }
  for (const d of [23, 25, 26, 27]) await feed(d, "Fodder", "OUT", 6, { notes: "Daily ration consumption" });
  await feed(22, "Wenda", "IN", 8, { notes: "Suncrop wanda, 8 bags (note dated 22-10-26)" });
  await feed(25, "Silage", "IN", 39200, { rate: 14.66, cost: 574600, notes: "980 maund at Rs 11.75 plus Rs 114,600 rent, unloading, pressing, inoculant and covering labour; final Rs 586/maund (Rs 14.65/kg)" });
  // AI of tag 55 on 26 Oct with Florus (c)
  const c55 = await p.cow.findFirst({ where: { tag: "55" } });
  if (c55 && !(await p.insemination.findFirst({ where: { cowId: c55.id, date: day(26) } }))) {
    say("AI    tag 55 on 2026-10-26, Florus (c), service 5"); await run(() => p.insemination.create({ data: { cowId: c55.id, date: day(26), method: "AI", bullTag: "Florus (c)", serviceNumber: 5, notes: "Conventional semen (milk sheet of 26 Oct)", enteredBy: BY } }));
  }

  say(`\n${APPLY ? "APPLIED" : "DRY RUN"}: ${n.sale} sales, ${n.use} usage rows, ${n.feed} feed rows.`);
  await p.$disconnect();
})().catch((e) => { console.error(String(e.message).slice(0, 800)); process.exit(1); });
