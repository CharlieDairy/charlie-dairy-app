// Usage: node cb_2024.js [--apply]  Adds CashBook entries dated Mar-Dec 2024 and replaces the temporary 1 Jan 2025 opening balance.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const apply = process.argv.includes('--apply');
const MARK = 'CashBook 09-10-2026 (2024)';
const FILE = 'C:/Users/Admin/OneDrive/Desktop/Charlie/Charlie - daily petty cash 09-10-2026@CashBook.csv';
function parseCsv(t) { const rows = []; let row = [], cell = '', q = false; for (let i = 0; i < t.length; i++) { const c = t[i]; if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; } else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (c !== '\r') cell += c; } return rows; }
const MON = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const iso = (s) => { const [d, m, y] = s.split(' '); return `${y}-${MON[m]}-${d.padStart(2, '0')}`; };
const num = (s) => (s && s.trim() !== '' ? Number(s) : 0);
const time24 = (t) => { const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((t || '').trim()); if (!m) return null; let h = Number(m[1]) % 12; if (m[3].toUpperCase() === 'PM') h += 12; return `${String(h).padStart(2, '0')}:${m[2]}:00`; };

const rows = parseCsv(fs.readFileSync(FILE, 'utf8').replace(/^\uFEFF/, '')).slice(1).filter((r) => r.length >= 10 && r[0].endsWith(' 2024'))
  .map((r) => ({ date: iso(r[0]), time: r[1], remark: r[2], party: r[3], category: r[4], mode: r[5], by: r[6], inn: num(r[7]), out: num(r[8]), bal: num(r[9]), proj: r[10] || '' }));

(async () => {
  const p = new PrismaClient();
  const existing = await p.cashTransaction.count({ where: { date: { lt: new Date('2025-01-01T00:00:00Z') } } });
  const marked = await p.cashTransaction.count({ where: { account: MARK } });
  if (marked) throw new Error('2024 already imported (' + marked + ' rows). Stopping.');
  console.log('CashBook 2024 rows:', rows.length, '| entries in app dated before 2025 (excl. the temporary opening row):', existing - 1);
  const tmpOpen = await p.cashTransaction.findMany({ where: { category: 'Opening Balance', date: new Date('2025-01-01T00:00:00Z') } });
  console.log('temporary 1 Jan 2025 opening rows to remove:', tmpOpen.length, tmpOpen.map((r) => `in ${r.amountIn} out ${r.amountOut}`).join(';'));
  const add = rows.filter((r) => !(r.inn === 0 && r.out === 0));
  const net = add.reduce((n, r) => n + r.inn - r.out, 0);
  console.log('to add:', add.length, 'rows; 2024 net movement', Math.round(net), '(CashBook balance at 31 Dec 2024: ' + rows[rows.length - 1].bal + ')');
  if (!apply) { await p.$disconnect(); return; }
  const data = add.map((r) => ({
    date: new Date(r.date + 'T00:00:00.000Z'), time: time24(r.time), account: MARK, party: r.party || null,
    category: (r.category || '').trim() || 'Uncategorized', mode: /bank/i.test(r.mode || '') ? 'BANK' : 'CASH', amountIn: r.inn, amountOut: r.out,
    enteredBy: r.by || null, projectLand: r.proj || null, remark: (r.remark || '').trim() || null,
  }));
  for (let i = 0; i < data.length; i += 300) await p.cashTransaction.createMany({ data: data.slice(i, i + 300) });
  const del = await p.cashTransaction.deleteMany({ where: { id: { in: tmpOpen.map((r) => r.id) } } });
  console.log('inserted', data.length, '| removed temporary opening rows:', del.count);
  const a = await p.cashTransaction.aggregate({ _sum: { amountIn: true, amountOut: true } });
  const dec24 = await p.cashTransaction.aggregate({ where: { date: { lt: new Date('2025-01-01T00:00:00Z') } }, _sum: { amountIn: true, amountOut: true } });
  console.log('app cash at 31 Dec 2024:', Math.round(dec24._sum.amountIn - dec24._sum.amountOut), '(CashBook: ' + rows[rows.length - 1].bal + ')');
  console.log('app cash now:', Math.round(a._sum.amountIn - a._sum.amountOut), '(CashBook: -17474)');
  await p.$disconnect();
})().catch((e) => { console.error('STOPPED:', e.message); process.exit(1); });
