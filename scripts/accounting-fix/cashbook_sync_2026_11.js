// Compares the CashBook petty-cash export (20 Nov 2026) with the app's cash entries and lists what is missing.
//   node scripts/accounting-fix/cashbook_sync_2026_11.js "<csv path>"            (read-only report)
// Matching is by date + amount in + amount out (each app entry is used once), so differently worded remarks still match.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const FILE = process.argv.find((a, i) => i > 1 && !a.startsWith('--'));
function parseCsv(t) { const rows = []; let row = [], cell = '', q = false; for (let i = 0; i < t.length; i++) { const c = t[i]; if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; } else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (c !== '\r') cell += c; } if (cell !== '' || row.length) { row.push(cell); rows.push(row); } return rows; }
const MON = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const iso = (s) => { const [d, m, y] = s.split(' '); return `${y}-${MON[m]}-${d.padStart(2, '0')}`; };
const num = (s) => (s && s.trim() !== '' ? Number(s) : 0);

const rows = parseCsv(fs.readFileSync(FILE, 'utf8').replace(/^﻿/, '')).slice(1).filter((r) => r.length >= 10 && /^\d{2} \w{3} \d{4}$/.test(r[0]))
  .map((r) => ({ date: iso(r[0]), time: r[1], remark: r[2], party: r[3], category: (r[4] || '').trim(), mode: r[5], by: r[6], inn: num(r[7]), out: num(r[8]), bal: num(r[9]), proj: r[10] || '' }));

(async () => {
  const p = new PrismaClient();
  const app = await p.cashTransaction.findMany({ where: { mode: 'CASH' }, select: { id: true, date: true, category: true, amountIn: true, amountOut: true, remark: true, account: true, enteredBy: true } });
  const key = (d, i, o) => `${d}|${Math.round(i * 100)}|${Math.round(o * 100)}`;
  const pool = new Map();
  for (const a of app) { const k = key(a.date.toISOString().slice(0, 10), a.amountIn, a.amountOut); (pool.get(k) ?? pool.set(k, []).get(k)).push(a); }
  const missing = [];
  for (const r of rows) {
    const k = key(r.date, r.inn, r.out);
    const list = pool.get(k);
    if (list && list.length) list.shift(); else missing.push(r);
  }
  const extra = [...pool.values()].flat();
  console.log('CSV rows:', rows.length, 'range', rows[0].date, '->', rows[rows.length - 1].date, '| CSV closing balance', rows[rows.length - 1].bal);
  console.log('App CASH-mode entries:', app.length, '| app net', Math.round(app.reduce((n, a) => n + a.amountIn - a.amountOut, 0)));
  console.log('CSV rows NOT in the app:', missing.length, '| net of those', Math.round(missing.reduce((n, r) => n + r.inn - r.out, 0)));
  const byMonth = {};
  for (const r of missing) { const m = r.date.slice(0, 7); byMonth[m] = byMonth[m] || { n: 0, inn: 0, out: 0 }; byMonth[m].n++; byMonth[m].inn += r.inn; byMonth[m].out += r.out; }
  console.log('missing by month:', JSON.stringify(byMonth));
  console.log('App CASH entries NOT in the CSV:', extra.length, '| net', Math.round(extra.reduce((n, a) => n + a.amountIn - a.amountOut, 0)));
  const emap = {};
  for (const a of extra) { const m = a.date.toISOString().slice(0, 7) + ' ' + (a.account || '-'); emap[m] = (emap[m] || 0) + 1; }
  console.log('extra by month/source:', JSON.stringify(emap));
  console.log('CSV rows with no category:', rows.filter((r) => !r.category).length, '| missing rows with no category:', missing.filter((r) => !r.category).length);
  if (process.argv.includes('--list')) {
    for (const r of missing) console.log('MISSING', r.date, r.time, r.inn || '', r.out || '', '|', r.category || '(none)', '|', (r.remark || '').replace(/\s+/g, ' ').slice(0, 70));
    for (const a of extra) console.log('EXTRA  ', a.date.toISOString().slice(0, 10), a.amountIn || '', a.amountOut || '', '|', a.category, '|', (a.remark || '').replace(/\s+/g, ' ').slice(0, 70), '|', a.account || '', a.enteredBy || '');
  }
  if (!process.argv.includes('--apply')) { console.log('Preview only. Take a backup, then add --apply to write.'); await p.$disconnect(); return; }

  // ---- write step -------------------------------------------------------------------------------------------
  const MARK = 'CashBook sync 20-11-2026';
  const WHO = 'CashBook sync (20 Nov 2026)';
  if (await p.cashTransaction.count({ where: { account: MARK } })) throw new Error('already applied (rows with this marker exist). Stopping.');
  const add = missing.filter((r) => !(r.inn === 0 && r.out === 0));
  // Milk receipts since 1 Sep 2026 are counted when BILLED, so each one is attached to its customer's payment (no double count).
  const MILK_TO = {
    '2026-10-13|170510': 'City Sale', '2026-10-21|172980': 'City Sale', '2026-10-31|5850': 'Hafiz Muneeb', '2026-10-31|10640': 'Mehtab',
    '2026-11-02|8700': 'Hafiz Muneeb', '2026-11-02|10600': 'Farm Sale', '2026-11-02|207860': 'City Sale', '2026-11-11|187250': 'City Sale',
    '2026-11-16|8000': 'Abdur Rasheed', '2026-11-17|24000': 'Nawaz Khan',
  };
  const customers = new Set((await p.customer.findMany({ select: { name: true } })).map((c) => c.name));
  for (const w of Object.values(MILK_TO)) if (!customers.has(w)) throw new Error('unknown customer ' + w);
  const time24 = (t) => { const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((t || '').trim()); if (!m) return null; let h = Number(m[1]) % 12; if (m[3].toUpperCase() === 'PM') h += 12; return `${String(h).padStart(2, '0')}:${m[2]}:00`; };
  const ops = [];
  let linked = 0;
  for (const r of add) {
    const tx = {
      date: new Date(r.date + 'T00:00:00.000Z'), time: time24(r.time), account: MARK, party: r.party || null,
      category: r.category || 'Uncategorized', mode: 'CASH', amountIn: r.inn, amountOut: r.out,
      enteredBy: r.by || null, projectLand: r.proj || null, remark: (r.remark || '').trim() || null,
    };
    if (/^transfer to agri expense book/i.test((r.remark || '').trim())) tx.accountClass = 'TRANSFER'; // money moved to another book, not a farm cost
    const buyer = r.category === 'Cash sale proceed for Milk' ? MILK_TO[`${r.date}|${r.inn}`] : null;
    if (r.category === 'Cash sale proceed for Milk' && !buyer) throw new Error('milk receipt with no customer mapped: ' + r.date + ' ' + r.inn);
    if (buyer) {
      tx.party = buyer; linked++;
      ops.push(p.customerPayment.create({ data: { buyer, date: tx.date, amount: r.inn, mode: 'CASH', notes: 'From the cash book receipt', enteredBy: WHO, cashTransaction: { create: tx } } }));
    } else ops.push(p.cashTransaction.create({ data: tx }));
  }
  // The 31 Oct silage purchase (Rs 931,400, 1,611 maund = 64,440 kg) is in the cash book but not in feed stock.
  const hasSilage = await p.feedTransaction.count({ where: { feedType: 'Silage', direction: 'IN', date: new Date('2026-10-31T00:00:00Z') } });
  if (!hasSilage) ops.push(p.feedTransaction.create({ data: { date: new Date('2026-10-31T00:00:00Z'), feedType: 'Silage', direction: 'IN', quantity: 64440, rate: 931400 / 64440, notes: 'Silage purchased 1611 maund (64440 kg), Rs 931,400, paid 02-11-26 (from the cash book)', enteredBy: WHO } }));
  // Animals the cash book says were sold.
  for (const [tag, why] of [['133', 'Male calf sold for Rs 80,000 on 21-10-26 (cash book)'], ['140', 'Sold with Tag 56 on 26-10-26 (cash book)']]) {
    const cow = await p.cow.findMany({ where: { tag }, select: { id: true, status: true } });
    if (cow.length !== 1) throw new Error('tag ' + tag + ' not found exactly once');
    if (cow[0].status !== 'SOLD') {
      ops.push(p.cow.update({ where: { id: cow[0].id }, data: { status: 'SOLD' } }));
      ops.push(p.auditLog.create({ data: { userName: WHO, action: 'STATUS', entity: 'Cow', entityId: cow[0].id, oldValue: cow[0].status, newValue: 'SOLD: ' + why } }));
    }
  }
  await p.$transaction(ops);
  const after = await p.cashTransaction.aggregate({ where: { mode: 'CASH' }, _sum: { amountIn: true, amountOut: true } });
  console.log('inserted cash entries:', add.length, '| milk receipts linked to customers:', linked, '| silage added:', hasSilage ? 'already there' : 'yes');
  console.log('app cash now:', Math.round(after._sum.amountIn - after._sum.amountOut), '(CashBook closing balance: ' + rows[rows.length - 1].bal + ')');
  await p.$disconnect();
})().catch((e) => { console.error('STOPPED:', e.message); process.exit(1); });
