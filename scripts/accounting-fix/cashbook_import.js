// Usage: node cb_load.js [--apply]   Adds ONLY the CashBook entries (2025+) that the app does not already have.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const apply = process.argv.includes('--apply');
const MARK = 'CashBook 09-10-2026';
const cb = JSON.parse(fs.readFileSync(__dirname + '/cb_rows.json', 'utf8'));

const time24 = (t) => {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((t || '').trim());
  if (!m) return null;
  let h = Number(m[1]) % 12; if (m[3].toUpperCase() === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${m[2]}:00`;
};

(async () => {
  const p = new PrismaClient();
  const already = await p.cashTransaction.count({ where: { account: MARK } });
  if (already) throw new Error(`already imported (${already} rows). Stopping.`);
  const db = await p.cashTransaction.findMany({ where: { date: { gte: new Date('2025-01-01T00:00:00Z') } }, select: { date: true, amountIn: true, amountOut: true } });
  const keyOf = (d, i, o) => `${d}|${Math.round(i)}|${Math.round(o)}`;
  const have = new Map();
  for (const r of db) { const k = keyOf(r.date.toISOString().slice(0, 10), r.amountIn, r.amountOut); have.set(k, (have.get(k) || 0) + 1); }
  const add = [];
  for (const r of cb) {
    if (r.inn === 0 && r.out === 0) continue; // zero-amount rows carry no money
    const k = keyOf(r.date, r.inn, r.out);
    const c = have.get(k) || 0;
    if (c > 0) { have.set(k, c - 1); continue; }
    add.push(r);
  }
  const byMonth = {};
  add.forEach((r) => { const m = r.date.slice(0, 7); byMonth[m] = byMonth[m] || [0, 0, 0]; byMonth[m][0]++; byMonth[m][1] += r.inn; byMonth[m][2] += r.out; });
  console.log(`rows to add: ${add.length}`);
  console.log(Object.entries(byMonth).map(([m, v]) => `${m}: ${v[0]} rows, in ${Math.round(v[1]).toLocaleString()}, out ${Math.round(v[2]).toLocaleString()}`).join('\n'));
  if (!apply) { await p.$disconnect(); return; }

  const data = add.map((r) => {
    const mode = /bank/i.test(r.mode || '') ? 'BANK' : 'CASH';
    return {
      date: new Date(r.date + 'T00:00:00.000Z'), time: time24(r.time), account: MARK, party: r.party || null,
      category: (r.category || '').trim() || 'Uncategorized', mode, amountIn: r.inn, amountOut: r.out,
      enteredBy: r.by || null, projectLand: r.proj || null, remark: (r.remark || '').trim() || null,
    };
  });
  let n = 0;
  for (let i = 0; i < data.length; i += 300) { const c = data.slice(i, i + 300); await p.cashTransaction.createMany({ data: c }); n += c.length; }
  console.log('inserted', n);

  const after = await p.$queryRaw`SELECT to_char(date,'YYYY-MM') m, COUNT(*)::int n, ROUND(SUM("amountIn")::numeric) i, ROUND(SUM("amountOut")::numeric) o FROM "CashTransaction" WHERE date >= '2025-01-01' GROUP BY 1 ORDER BY 1`;
  const exp = {}; cb.forEach((r) => { if (r.inn === 0 && r.out === 0) return; const m = r.date.slice(0, 7); exp[m] = exp[m] || [0, 0, 0]; exp[m][0]++; exp[m][1] += r.inn; exp[m][2] += r.out; });
  let bad = 0;
  for (const x of after) {
    const e = exp[x.m] || [0, 0, 0];
    const ok = x.n === e[0] && Number(x.i) === Math.round(e[1]) && Number(x.o) === Math.round(e[2]);
    if (!ok) bad++;
    console.log(`${x.m} app ${x.n} rows ${Number(x.i)} / ${Number(x.o)}  CashBook ${e[0]} rows ${Math.round(e[1])} / ${Math.round(e[2])}  ${ok ? 'MATCH' : 'DIFFERENT'}`);
  }
  console.log(bad === 0 ? 'ALL MONTHS MATCH CASHBOOK' : `${bad} month(s) differ`);
  await p.$disconnect();
})().catch((e) => { console.error('STOPPED:', e.message); process.exit(1); });
