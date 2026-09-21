// One-time (idempotent) backfill: populates MasterDataItem from the app's fixed
// enum-backed categories, and auto-discovers existing free-text values (feed
// types, cash categories, asset classes, capital partners) as the starting
// point for the admin-managed "open" categories. Safe to re-run.
import { PrismaClient } from "@prisma/client";
import { MASTER_CATEGORIES } from "../../src/lib/masterData";

const prisma = new PrismaClient();

async function seedOpen(category: string, values: string[]) {
  const unique = Array.from(new Set(values.filter(Boolean)));
  for (let i = 0; i < unique.length; i++) {
    const code = unique[i];
    await prisma.masterDataItem.upsert({
      where: { category_code: { category, code } },
      update: {},
      create: { category, code, label: code, locked: false, sortOrder: i },
    });
  }
  console.log(`Seeded ${unique.length} items for ${category}`);
}

async function main() {
  for (const cat of MASTER_CATEGORIES.filter((c) => c.locked)) {
    const codes = cat.seedCodes ?? [];
    for (let i = 0; i < codes.length; i++) {
      const sc = codes[i];
      await prisma.masterDataItem.upsert({
        where: { category_code: { category: cat.key, code: sc.code } },
        update: {},
        create: { category: cat.key, code: sc.code, label: sc.label, locked: true, sortOrder: i },
      });
    }
    console.log(`Seeded ${codes.length} items for ${cat.key} (locked)`);
  }

  const feedTypes = await prisma.feedTransaction.findMany({ select: { feedType: true }, distinct: ["feedType"] });
  await seedOpen("FEED_TYPE", feedTypes.map((f) => f.feedType));

  const cashCategories = await prisma.cashTransaction.findMany({ select: { category: true }, distinct: ["category"] });
  await seedOpen("CASH_CATEGORY", cashCategories.map((c) => c.category));

  const assetClasses = await prisma.asset.findMany({ select: { assetClass: true }, distinct: ["assetClass"] });
  await seedOpen("ASSET_CLASS", assetClasses.map((a) => a.assetClass));

  const partners = await prisma.capitalEntry.findMany({ select: { partner: true }, distinct: ["partner"] });
  await seedOpen("CAPITAL_PARTNER", partners.map((p) => p.partner));

  console.log("\nMaster data seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
