// Aligns the app with "Charlie Dairy 2026.xlsx" for August, September and October (1-15) 2026, 29 Oct 2026.
// Only the differences found by the line-by-line comparison are touched. Dry run by default; add --apply to write.
// Back up first: node scripts/backup-daily.js
// Needs E:\Charlie\audit\_wb_feed.json: { "2026-09-07": { "Wenda": [in, out, rate, cost], ... } } read from the workbook's Feed Cost sheet.
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const APPLY = process.argv.includes("--apply");
const NOTE = "Aligned to Charlie Dairy 2026.xlsx (29 Oct 2026).";
const BY = "Reconciliation (29 Oct 2026)";
const p = new PrismaClient();
const D = (s) => new Date(s + "T00:00:00.000Z");
const iso = (x) => x.toISOString().slice(0, 10);
const say = (s) => console.log(s);
const run = async (fn) => { if (APPLY) await fn(); };

(async () => {
  // 1. Milk by cow ---------------------------------------------------------------------------------------------
  // tag 107 gave milk on 1-3 Sep in the workbook but nothing was entered
  const c107 = await p.cow.findFirst({ where: { tag: "107" } });
  const M107 = { "2026-09-01": [5.5, 3.5, 4.0], "2026-09-02": [4.0, 4.1, 3.7], "2026-09-03": [5.5, 4.0, 4.5] }; // morning, afternoon, evening
  for (const [dt, v] of Object.entries(M107)) for (const [i, shift] of ["MORNING", "AFTERNOON", "EVENING"].entries()) {
    if (await p.milkingRecord.findFirst({ where: { cowId: c107.id, date: D(dt), shift } })) continue;
    say(`milk  tag 107 ${dt} ${shift} ${v[i]} L`); await run(() => p.milkingRecord.create({ data: { cowId: c107.id, date: D(dt), shift, litres: v[i], enteredBy: BY } }));
  }
  // 7 Oct: the entries of tag 48 and tag 50 were swapped (the sheet and the workbook: 48 = 4.7/4.3/3.5, 50 = 9.0/7.5/7.0)
  for (const [tag, vals] of [["48", [4.7, 4.3, 3.5]], ["50", [9, 7.5, 7]]]) {
    const c = await p.cow.findFirst({ where: { tag } });
    for (const [i, shift] of ["MORNING", "AFTERNOON", "EVENING"].entries()) {
      const r = await p.milkingRecord.findFirst({ where: { cowId: c.id, date: D("2026-10-07"), shift } });
      if (r && r.litres !== vals[i]) { say(`milk  tag ${tag} 2026-10-07 ${shift} ${r.litres} -> ${vals[i]}`); await run(() => p.milkingRecord.update({ where: { id: r.id }, data: { litres: vals[i] } })); }
    }
  }

  // 2. Milk sales on 3 and 4 Sep: Hafiz 3 L was Mehtab's; Abdur 3 L on the 4th was Mehtab's ---------------------
  const sale = async (dt, buyer, litres, rate) => {
    const r = await p.milkSale.findFirst({ where: { date: D(dt), buyer } });
    if (r && (r.litres !== litres)) { say(`sale  ${dt} ${buyer} ${r.litres} -> ${litres} L`); await run(() => p.milkSale.update({ where: { id: r.id }, data: { litres, amount: Math.round(litres * rate) } })); }
  };
  await sale("2026-09-03", "Mehtab", 3, 170); await sale("2026-09-04", "Mehtab", 3, 170); await sale("2026-09-04", "Abdur Rasheed", 1, 120);
  const h = await p.milkSale.findMany({ where: { date: D("2026-09-03"), buyer: "Hafiz Muneeb", litres: 3 } });
  if (h.length === 1) { say("sale  2026-09-03 Hafiz Muneeb 3 L removed (not in the workbook; it was Mehtab's milk)"); await run(() => p.milkSale.delete({ where: { id: h[0].id } })); }

  // 3. Feed: quantities, then rate and cost on every issue ----------------------------------------------------
  const W = JSON.parse(fs.readFileSync("E:/Charlie/audit/_wb_feed.json"));
  const fix = async (dt, type, qty) => { const r = await p.feedTransaction.findFirst({ where: { date: D(dt), feedType: type, direction: "OUT" } }); if (r && r.quantity !== qty) { say(`feed  ${dt} ${type} OUT ${r.quantity} -> ${qty}`); await run(() => p.feedTransaction.update({ where: { id: r.id }, data: { quantity: qty } })); } };
  await fix("2026-09-14", "Silage", 400); await fix("2026-10-13", "Turi", 80);
  const last = W["2026-10-15"]; // rates carried forward after the workbook ends
  const rate = { Silage: last.Silage[2], Wenda: last.Wenda[2], Turi: last.Turi[2], Fodder: last.Fodder[2] };
  // weighted-average silage rate once the 980 maund delivery of 25 Oct (Rs 574,600 for 39,200 kg) is in stock
  const sIn = await p.feedTransaction.aggregate({ where: { feedType: "Silage", direction: "IN", date: { lt: D("2026-10-25") } }, _sum: { quantity: true } });
  const sOut = await p.feedTransaction.aggregate({ where: { feedType: "Silage", direction: "OUT", date: { lt: D("2026-10-25") } }, _sum: { quantity: true } });
  const stock = (sIn._sum.quantity || 0) - (sOut._sum.quantity || 0);
  const newRate = Math.round(((stock * rate.Silage + 574600) / (stock + 39200)) * 1000) / 1000;
  say(`silage after the 25 Oct delivery: ${stock} kg at ${rate.Silage} + 39,200 kg at 14.658 -> ${newRate} per kg`);
  const outs = await p.feedTransaction.findMany({ where: { direction: "OUT", date: { gte: D("2026-08-01"), lt: D("2026-10-30") }, feedType: { in: ["Silage", "Wenda", "Turi", "Fodder"] } }, orderBy: { date: "asc" } });
  let n = 0;
  for (const r of outs) {
    const dt = iso(r.date); const w = (W[dt] || {})[r.feedType];
    let rt, cost;
    if (w && dt <= "2026-10-15") { rt = w[2]; cost = r.quantity === w[1] ? w[3] : Math.round(r.quantity * w[2] * 100) / 100; }
    else if (dt > "2026-10-15") { rt = r.feedType === "Silage" && dt >= "2026-10-25" ? newRate : rate[r.feedType]; cost = Math.round(r.quantity * rt * 100) / 100; }
    else continue;
    if (r.rate === rt && Math.abs((r.cost || 0) - cost) < 0.01) continue;
    n++; if (n <= 6 || dt >= "2026-10-25") say(`cost  ${dt} ${r.feedType} ${r.quantity} @ ${rt} = ${cost}`);
    await run(() => p.feedTransaction.update({ where: { id: r.id }, data: { rate: rt, cost, notes: ((r.notes || "") + " " + NOTE).trim() } }));
  }
  say(`cost  ${n} feed issues valued in all (Aug-Sep as in the workbook; Oct 1-15 as in the workbook; Oct 16-29 at the last workbook rates)`);

  say(APPLY ? "\nAPPLIED." : "\nDRY RUN only. Add --apply to write.");
  await p.$disconnect();
})().catch((e) => { console.error(String(e.message).slice(0, 800)); process.exit(1); });
