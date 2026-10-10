// Usage: npx tsx scripts/accounting-fix/bank_import.ts [--apply]
// Adds the Meezan Bank Account CashBook entries from 1 Mar 2024 (the same window as the petty cash book) and
// marks the petty-cash "Cash from Company" receipts that are the other side of a bank-to-petty-cash transfer.
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import { classifyCash, CLASS_LABEL, type CashClassKey } from "../../src/lib/accounting/cashClass";

const apply = process.argv.includes("--apply");
const MARK = "CashBook Meezan 09-10-2026";
const FILE = process.env.BANK_CSV ?? "E:/Charlie/Meezan Bank Account 09-10-2026@CashBook.csv";
const FROM = "2024-03-01";

function parseCsv(t: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; } else if (c !== "\r") cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); } // the last line has no trailing newline
  return rows;
}
const MON: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
const iso = (s: string) => { const [d, m, y] = s.split(" "); return `${y}-${MON[m]}-${d.padStart(2, "0")}`; };
const num = (s: string) => (s && s.trim() !== "" ? Number(s) : 0);
const time24 = (t: string) => { const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((t || "").trim()); if (!m) return null; let h = Number(m[1]) % 12; if (m[3].toUpperCase() === "PM") h += 12; return `${String(h).padStart(2, "0")}:${m[2]}:00`; };
const day = (s: string) => Math.round(new Date(s + "T00:00:00Z").getTime() / 86400000);

(async () => {
  const p = new PrismaClient();
  const all = parseCsv(fs.readFileSync(FILE, "utf8").replace(/^\uFEFF/, "")).slice(1).filter((r) => r.length >= 9 && r[0])
    .map((r) => ({ date: iso(r[0]), time: r[1], remark: r[2], party: r[3], category: r[4], by: r[6], inn: num(r[7]), out: num(r[8]), bal: num(r[9]) }));
  if (await p.cashTransaction.count({ where: { account: MARK } })) throw new Error("bank book already imported. Stopping.");

  const before = all.filter((r) => r.date < FROM);
  const openingBal = before.length ? before[before.length - 1].bal : 0;
  const rows = all.filter((r) => r.date >= FROM && !(r.inn === 0 && r.out === 0));
  const finalBal = all[all.length - 1].bal;
  const net = rows.reduce((n, r) => n + r.inn - r.out, 0);
  console.log(`bank rows in window: ${rows.length} | opening bank balance at ${FROM}: ${openingBal} | net movement ${net} | closing check: ${openingBal + net} (CashBook shows ${finalBal})`);

  const cls = rows.map((r) => ({ ...r, cls: classifyCash({ category: r.category, amountIn: r.inn, amountOut: r.out, remark: r.remark }) }));
  const by: Record<string, { n: number; i: number; o: number }> = {};
  for (const r of cls) { const b = (by[r.cls] ??= { n: 0, i: 0, o: 0 }); b.n++; b.i += r.inn; b.o += r.out; }
  for (const [k, v] of Object.entries(by)) console.log(`  ${CLASS_LABEL[k as CashClassKey].padEnd(24)} ${String(v.n).padStart(3)} rows  in ${Math.round(v.i).toLocaleString().padStart(11)}  out ${Math.round(v.o).toLocaleString().padStart(11)}`);
  const review = cls.filter((r) => r.cls === "REVIEW");
  console.log("needs review:", review.length); review.forEach((r) => console.log("   ", r.date, r.inn || -r.out, r.remark));

  // The other side of each bank -> petty cash transfer: a petty "Cash from Company" receipt of the same amount a few days later.
  const petty = (await p.cashTransaction.findMany({ where: { category: "Cash from Company", accountClass: null, date: { gte: new Date(FROM + "T00:00:00Z") } }, orderBy: { date: "asc" } }))
    .map((r) => ({ id: r.id, date: r.date.toISOString().slice(0, 10), amt: r.amountIn, used: false }));
  const pairs: { bank: string; petty: string; amt: number; id: string }[] = [];
  for (const o of cls.filter((r) => r.cls === "TRANSFER")) {
    let best: (typeof petty)[number] | null = null;
    for (const r of petty) { if (r.used || r.amt !== o.out) continue; const d = day(r.date) - day(o.date); if (d < -5 || d > 14) continue; if (!best || Math.abs(d) < Math.abs(day(best.date) - day(o.date))) best = r; }
    if (best) { best.used = true; pairs.push({ bank: o.date, petty: best.date, amt: o.out, id: best.id }); }
  }
  const tr = cls.filter((r) => r.cls === "TRANSFER");
  console.log(`bank transfers to petty cash: ${tr.length} (Rs ${tr.reduce((n, r) => n + r.out, 0).toLocaleString()}); matched to a petty receipt of the same amount: ${pairs.length} (Rs ${pairs.reduce((n, r) => n + r.amt, 0).toLocaleString()})`);
  if (!apply) { await p.$disconnect(); return; }

  const data = [
    ...(openingBal !== 0 ? [{ date: new Date(FROM + "T00:00:00Z"), time: null, account: MARK, party: null, category: "Opening Balance", mode: "BANK" as const, amountIn: openingBal > 0 ? openingBal : 0, amountOut: openingBal < 0 ? -openingBal : 0, enteredBy: "Opening balance", projectLand: null, remark: `Meezan Bank Account balance carried from CashBook at ${FROM}` }] : []),
    ...rows.map((r) => ({ date: new Date(r.date + "T00:00:00Z"), time: time24(r.time), account: MARK, party: r.party || null, category: (r.category || "").trim() || "Uncategorized", mode: "BANK" as const, amountIn: r.inn, amountOut: r.out, enteredBy: r.by || null, projectLand: null, remark: (r.remark || "").trim() || null })),
  ];
  for (let i = 0; i < data.length; i += 200) await p.cashTransaction.createMany({ data: data.slice(i, i + 200) });
  for (const x of pairs) await p.cashTransaction.update({ where: { id: x.id }, data: { accountClass: "TRANSFER" } });
  console.log(`inserted ${data.length} bank rows; marked ${pairs.length} petty receipts as transfers`);

  const bank = await p.cashTransaction.aggregate({ where: { mode: "BANK", account: MARK }, _sum: { amountIn: true, amountOut: true } });
  console.log("app bank balance:", Math.round((bank._sum.amountIn ?? 0) - (bank._sum.amountOut ?? 0)), "| CashBook closing balance at 31 Jul 2025:", finalBal);
  await p.$disconnect();
})().catch((e) => { console.error("STOPPED:", e.message); process.exit(1); });
