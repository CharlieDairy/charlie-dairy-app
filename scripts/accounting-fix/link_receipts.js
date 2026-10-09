// Usage: node link_receipts.js [--apply]
// Attaches a CustomerPayment to each existing milk receipt in the cash book since 1 Sep 2026 (no new cash rows).
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const apply = process.argv.includes('--apply');
// date | amount -> customer (decided from the remark; lump "Cash Recived milk sale dd to dd" receipts equal City Sale's bill for that period)
const MAP = [
  ['2026-09-04', 62020, 'City Sale'],
  ['2026-09-08', 70530, 'City Sale'],
  ['2026-09-08', 5500, 'Abdur Rasheed'],
  ['2026-09-15', 115170, 'City Sale'],
  ['2026-09-16', 10200, 'Mehtab'],
  ['2026-09-16', 6150, 'Hafiz Muneeb'],
  ['2026-09-18', 48360, 'City Sale'],
  ['2026-09-30', 202590, 'City Sale'],
  ['2026-09-30', 9300, 'Farm Sale'],
  ['2026-10-07', 4800, 'Abdur Rasheed'],
  ['2026-10-08', 51020, 'Nawaz Khan'],
];
(async () => {
  const p = new PrismaClient();
  const customers = new Set((await p.customer.findMany({ select: { name: true } })).map((c) => c.name));
  let planned = 0;
  for (const [d, amt, who] of MAP) {
    if (!customers.has(who)) throw new Error('unknown customer ' + who);
    const tx = await p.cashTransaction.findFirst({ where: { date: new Date(d + 'T00:00:00Z'), amountIn: amt, category: 'Cash sale proceed for Milk' }, include: { customerPayment: true } });
    if (!tx) { console.log('NOT FOUND', d, amt); continue; }
    if (tx.customerPayment) { console.log('already linked', d, amt); continue; }
    planned++;
    console.log(`${apply ? 'linking' : 'would link'} ${d} Rs ${amt} -> ${who}`);
    if (apply) {
      await p.$transaction([
        p.customerPayment.create({ data: { buyer: who, date: tx.date, amount: amt, mode: tx.mode, notes: 'Linked from the cash book receipt', cashTransactionId: tx.id, enteredBy: 'Receipt linking (9 Oct 2026)' } }),
        p.cashTransaction.update({ where: { id: tx.id }, data: { party: who } }),
      ]);
    }
  }
  console.log('receipts to link:', planned);
  await p.$disconnect();
})().catch((e) => { console.error('STOPPED:', e.message); process.exit(1); });
