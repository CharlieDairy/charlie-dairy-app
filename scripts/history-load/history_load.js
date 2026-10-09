// Usage: node history_load.js <feed|cash|milking|sales|usage> [--apply]
// Without --apply it only reports what it WOULD do. Every stage refuses to run twice.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const p = new PrismaClient();
const H = JSON.parse(fs.readFileSync(path.join(__dirname, 'history.json'), 'utf8'));
const MARK = 'History load (Excel)';
const SALES_MARK = 'Backfill (cash ledger)';
const D = (s) => new Date(s + 'T00:00:00.000Z');
const stage = process.argv[2];
const apply = process.argv.includes('--apply');
const SEP1 = D('2026-09-01');

async function chunked(rows, size, fn) {
  let n = 0;
  for (let i = 0; i < rows.length; i += size) { await fn(rows.slice(i, i + size)); n += Math.min(size, rows.length - i); }
  return n;
}

async function feed() {
  const already = await p.feedTransaction.count({ where: { notes: { contains: 'History load' } } });
  if (already) throw new Error(`feed history already loaded (${already} rows). Stopping.`);
  const old = await p.feedTransaction.count({ where: { date: { lt: SEP1 } } });
  const sep = await p.feedTransaction.count({ where: { date: { gte: SEP1 }, direction: 'OUT' } });
  console.log(`existing rows before 1 Sep 2026 (to be replaced): ${old}`);
  console.log(`rows to insert from workbook (Oct 2025 - Aug 2026): ${H.feed.length}`);
  console.log(`Sep 2026 OUT rows kept, cost added from rates ${JSON.stringify(H.report.feed_sep_rates)}: ${sep}`);
  if (!apply) return;
  await p.$transaction(async (tx) => {
    await tx.feedTransaction.deleteMany({ where: { date: { lt: SEP1 } } });
    await chunked(H.feed, 500, (c) => tx.feedTransaction.createMany({
      data: c.map((t) => ({ date: D(t.date), feedType: t.feedType, direction: t.direction, quantity: t.quantity, rate: t.rate, cost: t.cost, notes: t.notes, enteredBy: MARK })),
    }));
    for (const [feedType, rate] of Object.entries(H.report.feed_sep_rates)) {
      await tx.feedTransaction.updateMany({ where: { date: { gte: SEP1 }, direction: 'OUT', feedType }, data: { rate } });
    }
    await tx.$executeRaw`UPDATE "FeedTransaction" SET cost = ROUND((rate * quantity)::numeric, 2) WHERE date >= ${SEP1} AND direction = 'OUT' AND rate IS NOT NULL`;
  }, { timeout: 120000, maxWait: 20000 });
  const bal = await p.$queryRaw`SELECT "feedType", ROUND(SUM(CASE WHEN direction='IN' THEN quantity ELSE -quantity END)::numeric,1) AS balance, COUNT(*)::int AS n FROM "FeedTransaction" GROUP BY 1 ORDER BY 1`;
  console.log('closing stock by feed:', JSON.stringify(bal));
  const cost = await p.$queryRaw`SELECT to_char(date,'YYYY-MM') m, ROUND(SUM(cost)::numeric) c FROM "FeedTransaction" GROUP BY 1 ORDER BY 1`;
  console.log('feed cost by month:', JSON.stringify(cost.map((r) => [r.m, Number(r.c)])));
}

async function cash() {
  const existing = await p.cashTransaction.count({ where: { date: { gte: D('2025-10-01'), lt: D('2026-01-01') } } });
  if (existing) throw new Error(`cash rows already exist for Oct-Dec 2025 (${existing}). Stopping.`);
  console.log(`cash rows to insert (Oct-Dec 2025): ${H.cash.length}`, JSON.stringify(H.report.cash_by_month));
  if (!apply) return;
  const n = await chunked(H.cash, 500, (c) => p.cashTransaction.createMany({
    data: c.map((t) => ({ date: D(t.date), time: t.time, account: t.account, party: t.party, category: t.category, mode: t.mode, amountIn: t.amountIn, amountOut: t.amountOut, enteredBy: t.enteredBy, projectLand: t.projectLand, remark: t.remark })),
  }));
  console.log('inserted', n);
  const r = await p.$queryRaw`SELECT to_char(date,'YYYY-MM') m, COUNT(*)::int n, ROUND(SUM("amountIn")::numeric) i, ROUND(SUM("amountOut")::numeric) o FROM "CashTransaction" WHERE date < '2026-01-01' GROUP BY 1 ORDER BY 1`;
  console.log('now in app:', JSON.stringify(r.map((x) => [x.m, x.n, Number(x.i), Number(x.o)])));
}

async function milking() {
  const existing = await p.milkingRecord.count({ where: { date: { lt: SEP1 } } });
  if (existing) throw new Error(`milking history already present (${existing} rows before Sep 2026). Stopping.`);
  const tags = [...new Set(H.milking.map((r) => r.tag))];
  const cows = await p.cow.findMany({ where: { tag: { in: tags } }, select: { id: true, tag: true } });
  const idOf = new Map(cows.map((c) => [c.tag, c.id]));
  const missing = tags.filter((t) => !idOf.has(t));
  console.log(`milking rows: ${H.milking.length} across ${tags.length} cows. Cows missing from the register: ${JSON.stringify(missing)}`);
  if (!apply) return;
  for (const t of missing) {
    if (t !== '56') throw new Error('unexpected missing cow ' + t);
    const c = await p.cow.create({ data: { tag: '56', gender: 'FEMALE', status: 'SOLD', breed: 'Friesian', source: 'Purchased', notes: 'Added by the 12-month history load: milked until 27 Jul 2026, purchased 19 Mar 2024. Status (sold / died) not confirmed in the workbooks - please correct.' } });
    idOf.set('56', c.id);
    console.log('created cow 56 as SOLD (to be confirmed)');
  }
  const n = await chunked(H.milking, 1000, (c) => p.milkingRecord.createMany({
    data: c.map((r) => ({ cowId: idOf.get(r.tag), shift: r.shift, litres: r.litres, date: D(r.date), enteredBy: MARK })),
  }));
  console.log('inserted', n);
  const r = await p.$queryRaw`SELECT to_char(date,'YYYY-MM') m, ROUND(SUM(litres)::numeric,1) l FROM "MilkingRecord" GROUP BY 1 ORDER BY 1`;
  console.log('litres by month in app:', JSON.stringify(r.map((x) => [x.m, Number(x.l)])));
}

async function sales() {
  const existing = await p.milkSale.count({ where: { enteredBy: SALES_MARK } });
  const before = await p.milkSale.count({ where: { date: { lt: SEP1 } } });
  if (existing || before) throw new Error(`sales history already present (${existing} marked, ${before} before Sep). Stopping.`);
  console.log(`sales rows to insert: ${H.sales.length}`, JSON.stringify(H.report.sales_by_month_litres_rs));
  if (!apply) return;
  const n = await chunked(H.sales, 1000, (c) => p.milkSale.createMany({
    data: c.map((s) => ({ date: D(s.date), buyer: s.buyer, litres: s.litres, rate: s.rate, amount: s.amount, enteredBy: SALES_MARK })),
  }));
  console.log('inserted', n);
  const r = await p.$queryRaw`SELECT to_char(date,'YYYY-MM') m, ROUND(SUM(litres)::numeric) l, ROUND(SUM(amount)::numeric) a FROM "MilkSale" WHERE "enteredBy" = ${SALES_MARK} GROUP BY 1 ORDER BY 1`;
  console.log('history sales in app:', JSON.stringify(r.map((x) => [x.m, Number(x.l), Number(x.a)])));
}

async function usage() {
  const existing = await p.milkUsageRecord.count({ where: { date: { lt: SEP1 } } });
  if (existing) throw new Error(`milk-use history already present (${existing}). Stopping.`);
  console.log(`milk-use rows to insert: ${H.usage.length}`, JSON.stringify(H.report.usage_litres_by_month));
  if (!apply) return;
  const n = await chunked(H.usage, 1000, (c) => p.milkUsageRecord.createMany({
    data: c.map((u) => ({ date: D(u.date), type: u.type, litres: u.litres, notes: u.notes, enteredBy: MARK })),
  }));
  console.log('inserted', n);
  const r = await p.$queryRaw`SELECT to_char(date,'YYYY-MM') m, ROUND(SUM(litres)::numeric) l FROM "MilkUsageRecord" GROUP BY 1 ORDER BY 1`;
  console.log('use by month in app:', JSON.stringify(r.map((x) => [x.m, Number(x.l)])));
}

const stages = { feed, cash, milking, sales, usage };
(async () => {
  if (!stages[stage]) { console.log('stage must be one of', Object.keys(stages).join(', ')); return; }
  console.log(`== ${stage} ${apply ? '(APPLY)' : '(dry run)'}`);
  await stages[stage]();
})().catch((e) => { console.error('STOPPED:', e.message); process.exitCode = 1; }).finally(() => p.$disconnect());
