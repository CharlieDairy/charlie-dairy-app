// Step 1 of the SQLite -> Postgres migration. Run this BEFORE switching
// prisma/schema.prisma's datasource provider. Dumps every table to JSON,
// preserving ids and relations, so import-to-postgres.ts can replay it
// against the new database exactly.
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const OUT_DIR = path.join(__dirname, "dump");

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const tables = [
    { name: "users", query: () => prisma.user.findMany() },
    { name: "cows", query: () => prisma.cow.findMany() },
    { name: "milkingRecords", query: () => prisma.milkingRecord.findMany() },
    { name: "milkSales", query: () => prisma.milkSale.findMany() },
    { name: "feedTransactions", query: () => prisma.feedTransaction.findMany() },
    { name: "cashTransactions", query: () => prisma.cashTransaction.findMany() },
    { name: "capitalEntries", query: () => prisma.capitalEntry.findMany() },
    { name: "assets", query: () => prisma.asset.findMany() },
    { name: "heatEvents", query: () => prisma.heatEvent.findMany() },
    { name: "inseminations", query: () => prisma.insemination.findMany() },
    { name: "pregnancyChecks", query: () => prisma.pregnancyCheck.findMany() },
    { name: "calvings", query: () => prisma.calving.findMany() },
    { name: "calves", query: () => prisma.calf.findMany() },
  ] as const;

  for (const t of tables) {
    const rows = await t.query();
    fs.writeFileSync(path.join(OUT_DIR, `${t.name}.json`), JSON.stringify(rows, null, 2));
    console.log(`Exported ${rows.length} rows -> ${t.name}.json`);
  }

  console.log(`\nDone. Dump written to ${OUT_DIR}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
