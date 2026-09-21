import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const DATA_DIR = path.join(__dirname, "..", "scripts", "migrate", "output");

function loadJson<T>(filename: string): T {
  const raw = fs.readFileSync(path.join(DATA_DIR, filename), "utf-8");
  return JSON.parse(raw) as T;
}

async function seedUsers() {
  const users = [
    { name: "Admin", username: "admin", password: "changeme-admin", role: "ADMIN" as const },
    { name: "Farm Entry", username: "entry", password: "changeme-entry", role: "ENTRY" as const },
  ];
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: { name: u.name, username: u.username, passwordHash, role: u.role },
    });
  }
  console.log(`Seeded ${users.length} users (dev passwords — change before real use).`);
}

async function seedCows() {
  const cows = loadJson<any[]>("cows.json");
  await prisma.cow.createMany({
    data: cows.map((c) => ({
      tag: c.tag,
      gender: c.gender,
      status: c.status,
      condition: c.condition ?? null,
      lastCalvingDate: c.lastCalvingDate ? new Date(c.lastCalvingDate) : null,
      expectedCalving: c.expectedCalving ? new Date(c.expectedCalving) : null,
      targetSellDate: c.targetSellDate ? new Date(c.targetSellDate) : null,
      notes: c.notes ?? null,
    })),
  });
  console.log(`Seeded ${cows.length} cows.`);
}

async function seedMilking() {
  const records = loadJson<any[]>("milking_records.json");
  const cows = await prisma.cow.findMany({ select: { id: true, tag: true } });
  const tagToId = new Map(cows.map((c) => [c.tag, c.id]));

  const batchSize = 1000;
  let inserted = 0;
  let unmatched = 0;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const data = batch.map((r) => {
      const cowId = tagToId.get(r.cowTag) ?? null;
      if (!cowId) unmatched++;
      return {
        cowId,
        date: new Date(r.date),
        shift: r.shift,
        litres: r.litres,
      };
    });
    await prisma.milkingRecord.createMany({ data });
    inserted += batch.length;
  }
  console.log(`Seeded ${inserted} milking records (${unmatched} had no matching cow tag, stored with null cowId).`);
}

async function seedCash() {
  const rows = loadJson<any[]>("cash_transactions.json");
  await prisma.cashTransaction.createMany({
    data: rows.map((r) => ({
      date: new Date(r.date),
      time: r.time,
      account: r.account,
      party: r.party,
      category: r.category,
      mode: r.mode,
      amountIn: r.amountIn,
      amountOut: r.amountOut,
      enteredBy: r.enteredBy,
      projectLand: r.projectLand,
      remark: r.remark,
    })),
  });
  console.log(`Seeded ${rows.length} cash transactions.`);
}

async function seedFeed() {
  const rows = loadJson<any[]>("feed_transactions.json");
  await prisma.feedTransaction.createMany({
    data: rows.map((r) => ({
      date: new Date(r.date),
      feedType: r.feedType,
      direction: r.direction,
      quantity: r.quantity,
      rate: r.rate,
      cost: r.cost,
    })),
  });
  console.log(`Seeded ${rows.length} feed transactions.`);
}

async function seedCapital() {
  const rows = loadJson<any[]>("capital_entries.json");
  await prisma.capitalEntry.createMany({
    data: rows.map((r) => ({
      date: new Date(r.date),
      partner: r.partner,
      description: r.description,
      debit: r.debit,
      credit: r.credit,
      bankAccount: r.bankAccount,
      type: r.type,
      venture: r.venture ?? null,
    })),
  });
  console.log(`Seeded ${rows.length} capital entries.`);
}

async function seedAssets() {
  const rows = loadJson<any[]>("assets.json");
  await prisma.asset.createMany({
    data: rows.map((r) => ({
      assetClass: r.assetClass,
      details: r.details,
      qty: r.qty,
      value: r.value,
      depreciationPct: r.depreciationPct,
      yearLived: r.yearLived,
      currentValue: r.currentValue,
      valuationDate: r.valuationDate ? new Date(r.valuationDate) : null,
    })),
  });
  console.log(`Seeded ${rows.length} assets.`);
}

async function main() {
  await seedUsers();
  await seedCows();
  await seedMilking();
  await seedCash();
  await seedFeed();
  await seedCapital();
  await seedAssets();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
