// One-time backfill: populates the structured MilkSale table (buyer, litres,
// amount) from CashTransaction rows in category "Cash sale proceed for Milk",
// so the dashboard's sales summary has real historical revenue to show.
//
// What this can and can't recover, honestly:
// - Revenue (Rs) is accurate for every row — amountIn is a real recorded figure.
// - Quantity (litres) is only recoverable where the remark text contains an
//   explicit "<N> kg" mention (18 of 89 rows, ~20%). The rest are period
//   settlements like "Cash Received milk sale 04-01-26 to 06-01-26" with no
//   quantity anywhere — those rows get litres = 0, not a guess.
// - Buyer was never recorded anywhere in this farm's bookkeeping (the `party`
//   column is empty on all 416 cash rows, not just milk ones), so every
//   backfilled row gets buyer = "Unknown". "# of customers" on the dashboard
//   only counts non-"Unknown" buyers, which will be 0 until real entries are
//   logged going forward via Milk Sale Entry.
// - 2 rows explicitly marked "Wrong Entry" / "Wrong entry as Cash Out" by the
//   original bookkeeper are excluded entirely — one even has "1kg Daily" in
//   unrelated billing text that would otherwise falsely parse as a real
//   quantity.
//
// Idempotent: refuses to run twice (checks for its own enteredBy marker).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const MARKER = "Backfill (cash ledger)";
const KG_PATTERN = /(\d+(?:\.\d+)?)\s*kg/i;

async function main() {
  const already = await prisma.milkSale.count({ where: { enteredBy: MARKER } });
  if (already > 0) {
    console.log(`Already backfilled (${already} rows tagged "${MARKER}"). Delete those rows first if you want to redo this.`);
    return;
  }

  const rows = await prisma.cashTransaction.findMany({
    where: { category: "Cash sale proceed for Milk" },
    select: { date: true, amountIn: true, remark: true },
  });

  const excluded: string[] = [];
  const toCreate: { date: Date; buyer: string; litres: number; amount: number; enteredBy: string }[] = [];

  for (const r of rows) {
    const remark = r.remark ?? "";
    if (/wrong/i.test(remark)) {
      excluded.push(remark);
      continue;
    }
    const match = remark.match(KG_PATTERN);
    const litres = match ? parseFloat(match[1]) : 0;
    toCreate.push({ date: r.date, buyer: "Unknown", litres, amount: r.amountIn, enteredBy: MARKER });
  }

  const result = await prisma.milkSale.createMany({ data: toCreate });

  const withQty = toCreate.filter((r) => r.litres > 0);
  const totalAmount = toCreate.reduce((s, r) => s + r.amount, 0);
  const totalLitres = toCreate.reduce((s, r) => s + r.litres, 0);

  console.log(`Backfilled ${result.count} MilkSale rows from ${rows.length} cash transactions.`);
  console.log(`  - ${withQty.length} rows had a recorded quantity (${totalLitres.toLocaleString()} L total)`);
  console.log(`  - ${toCreate.length - withQty.length} rows had no quantity in the remark (litres = 0, amount preserved)`);
  console.log(`  - ${excluded.length} rows excluded as "Wrong Entry" corrections`);
  console.log(`  - Total revenue backfilled: Rs ${totalAmount.toLocaleString()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
