// Fills the Team module's salary records from the salary entries already in the cash book.
//   node scripts/accounting-fix/salary_records_from_cashbook.js            preview only
//   node scripts/accounting-fix/salary_records_from_cashbook.js --apply    write (take a backup first)
// Each cash entry in a salary category whose remark names an employee gets a SalaryPayment linked to THAT cash entry
// (cashTransactionId), so no cash row is created and no figure in the P&L, cash flow or balance sheet changes.
// Entries that name nobody are listed and left alone. Safe to re-run: entries already linked are skipped.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const apply = process.argv.includes('--apply');
const WHO = 'Salary backfill (cash book, 20 Nov 2026)';
const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

// "Sep" in "Abdul Basit salary Sep" means the salary is FOR September: this year, or last year if September is after the payment month.
// With no month in the remark (an advance, a part payment) it is for the month it was paid.
function forMonthOf(remark, date) {
  const words = (remark || '').toLowerCase().match(/[a-z]+/g) || [];
  const named = words.find((w) => MONTHS[w]);
  const py = date.getUTCFullYear(), pm = date.getUTCMonth() + 1;
  const m = named ? MONTHS[named] : pm;
  const y = m > pm ? py - 1 : py;
  return `${y}-${String(m).padStart(2, '0')}`;
}

(async () => {
  const p = new PrismaClient();
  const employees = await p.employee.findMany({ select: { id: true, name: true, active: true } });
  const tagOf = (e) => e.name.trim().split(/\s+/).pop().toLowerCase();
  const cash = await p.cashTransaction.findMany({
    where: { category: { contains: 'salar', mode: 'insensitive' }, amountOut: { gt: 0 } },
    orderBy: { date: 'asc' },
    select: { id: true, date: true, category: true, amountOut: true, mode: true, remark: true, party: true, salaryPayment: { select: { id: true } } },
  });
  const rows = [], unmatched = [];
  let already = 0;
  for (const c of cash) {
    if (c.salaryPayment) { already++; continue; }
    const text = ((c.remark || '') + ' ' + (c.party || '')).toLowerCase();
    if (/temporary\s+lab/.test(text)) { unmatched.push(c); continue; } // casual labour is not anyone's salary, whoever is named
    // How the cash book writes each person: "A.B" is Abdul Basit, "Haleem" is a typo of Hakeem.
    const ALIAS = { basit: /basit|\ba\.b\b/, hakeem: /hakeem|hakim|haleem/ };
    const hits = employees.filter((e) => (ALIAS[tagOf(e)] || new RegExp(tagOf(e))).test(text));
    if (hits.length !== 1) { unmatched.push(c); continue; }
    rows.push({ emp: hits[0], c, forMonth: forMonthOf(c.remark, c.date) });
  }
  const by = {};
  for (const r of rows) {
    const k = r.emp.name;
    by[k] = by[k] || { n: 0, total: 0, first: r.c.date, last: r.c.date };
    by[k].n++; by[k].total += r.c.amountOut;
    if (r.c.date > by[k].last) by[k].last = r.c.date;
  }
  console.log('salary-category cash entries:', cash.length, '| already linked:', already, '| to create:', rows.length, '| no single employee named:', unmatched.length);
  for (const [k, v] of Object.entries(by)) console.log(' ', k.padEnd(14), v.n, 'payments, Rs', Math.round(v.total), v.first.toISOString().slice(0, 10), '->', v.last.toISOString().slice(0, 10));
  console.log('unmatched entries (left alone):');
  for (const c of unmatched) console.log('  ', c.date.toISOString().slice(0, 10), c.amountOut, '|', c.category, '|', (c.remark || '').replace(/\s+/g, ' ').slice(0, 70));
  if (process.argv.includes('--list')) for (const r of rows.slice(-25)) console.log('  ', r.c.date.toISOString().slice(0, 10), r.emp.name.padEnd(12), r.c.amountOut, 'for', r.forMonth, '|', (r.c.remark || '').replace(/\s+/g, ' ').slice(0, 40));
  if (!apply) { console.log('Preview only. Take a backup, then add --apply.'); await p.$disconnect(); return; }
  const data = rows.map((r) => ({ employeeId: r.emp.id, date: r.c.date, amount: r.c.amountOut, forMonth: r.forMonth, mode: r.c.mode, notes: 'From the cash book entry', cashTransactionId: r.c.id, enteredBy: WHO }));
  for (let i = 0; i < data.length; i += 300) await p.salaryPayment.createMany({ data: data.slice(i, i + 300) });
  const n = await p.salaryPayment.count();
  console.log('created', data.length, '| salary records now:', n);
  await p.$disconnect();
})().catch((e) => { console.error('STOPPED:', e.message); process.exit(1); });
