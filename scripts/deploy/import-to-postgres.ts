// Step 3 of the SQLite -> Postgres migration. Run this AFTER:
//   1. prisma/schema.prisma datasource provider is set to "postgresql"
//   2. DATABASE_URL in .env points at the new Postgres database
//   3. `npx prisma db push` (or migrate deploy) has created the tables there
// Replays the JSON dump from export-sqlite-data.ts, preserving ids/relations.
import { PrismaClient, Prisma } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const DUMP_DIR = path.join(__dirname, "dump");

function load<T>(name: string): T[] {
  const file = path.join(DUMP_DIR, `${name}.json`);
  if (!fs.existsSync(file)) throw new Error(`Missing dump file: ${file}. Run export-sqlite-data.ts first.`);
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

async function main() {
  // Order matters: parents before children (foreign keys).
  const users = load<Prisma.UserCreateManyInput>("users");
  await prisma.user.createMany({ data: users });
  console.log(`Imported ${users.length} users`);

  const cows = load<Prisma.CowCreateManyInput>("cows");
  await prisma.cow.createMany({ data: cows });
  console.log(`Imported ${cows.length} cows`);

  const milkingRecords = load<Prisma.MilkingRecordCreateManyInput>("milkingRecords");
  await prisma.milkingRecord.createMany({ data: milkingRecords });
  console.log(`Imported ${milkingRecords.length} milking records`);

  const milkSales = load<Prisma.MilkSaleCreateManyInput>("milkSales");
  await prisma.milkSale.createMany({ data: milkSales });
  console.log(`Imported ${milkSales.length} milk sales`);

  const feedTransactions = load<Prisma.FeedTransactionCreateManyInput>("feedTransactions");
  await prisma.feedTransaction.createMany({ data: feedTransactions });
  console.log(`Imported ${feedTransactions.length} feed transactions`);

  const cashTransactions = load<Prisma.CashTransactionCreateManyInput>("cashTransactions");
  await prisma.cashTransaction.createMany({ data: cashTransactions });
  console.log(`Imported ${cashTransactions.length} cash transactions`);

  const capitalEntries = load<Prisma.CapitalEntryCreateManyInput>("capitalEntries");
  await prisma.capitalEntry.createMany({ data: capitalEntries });
  console.log(`Imported ${capitalEntries.length} capital entries`);

  const assets = load<Prisma.AssetCreateManyInput>("assets");
  await prisma.asset.createMany({ data: assets });
  console.log(`Imported ${assets.length} assets`);

  const heatEvents = load<Prisma.HeatEventCreateManyInput>("heatEvents");
  await prisma.heatEvent.createMany({ data: heatEvents });
  console.log(`Imported ${heatEvents.length} heat events`);

  const inseminations = load<Prisma.InseminationCreateManyInput>("inseminations");
  await prisma.insemination.createMany({ data: inseminations });
  console.log(`Imported ${inseminations.length} inseminations`);

  const pregnancyChecks = load<Prisma.PregnancyCheckCreateManyInput>("pregnancyChecks");
  await prisma.pregnancyCheck.createMany({ data: pregnancyChecks });
  console.log(`Imported ${pregnancyChecks.length} pregnancy checks`);

  const calvings = load<Prisma.CalvingCreateManyInput>("calvings");
  await prisma.calving.createMany({ data: calvings });
  console.log(`Imported ${calvings.length} calvings`);

  const calves = load<Prisma.CalfCreateManyInput>("calves");
  await prisma.calf.createMany({ data: calves });
  console.log(`Imported ${calves.length} calves`);

  console.log("\nImport complete. Spot-check row counts against the export log before deleting the dump.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
