const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

const DATE_FIELDS = {
  cow: ['dateOfBirth', 'lastCalvingDate', 'nextAiDate', 'dryDate', 'expectedCalving', 'targetSellDate', 'createdAt', 'updatedAt'],
  milkingRecord: ['date', 'createdAt'],
  milkSale: ['date', 'createdAt'],
};

function reviveDates(rows, fields) {
  return rows.map((r) => {
    const copy = { ...r };
    for (const f of fields) {
      if (copy[f] !== null && copy[f] !== undefined) copy[f] = new Date(copy[f]);
    }
    return copy;
  });
}

async function restoreInBatches(model, rows, batchSize = 1000) {
  let total = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const result = await prisma[model].createMany({ data: batch });
    total += result.count;
  }
  return total;
}

(async () => {
  const backupDir = path.join(__dirname, '..', 'backups');
  const files = fs.readdirSync(backupDir).filter(f => f.startsWith('full-backup-'));
  const latest = files.sort().reverse()[0];
  const backup = JSON.parse(fs.readFileSync(path.join(backupDir, latest), 'utf8'));
  console.log('Restoring from backup:', latest, '\n');

  const cowCount = await prisma.cow.count();
  if (cowCount === 0) {
    const cows = reviveDates(backup.cow, DATE_FIELDS.cow);
    const n = await restoreInBatches('cow', cows);
    console.log(`Restored cow: ${n}`);
  } else {
    console.log(`cow already has ${cowCount} rows, skipping.`);
  }

  const milkingCount = await prisma.milkingRecord.count();
  if (milkingCount === 0) {
    const records = reviveDates(backup.milkingRecord, DATE_FIELDS.milkingRecord);
    const n = await restoreInBatches('milkingRecord', records);
    console.log(`Restored milkingRecord: ${n}`);
  } else {
    console.log(`milkingRecord already has ${milkingCount} rows, skipping.`);
  }

  const saleCount = await prisma.milkSale.count();
  if (saleCount === 0) {
    const sales = reviveDates(backup.milkSale, DATE_FIELDS.milkSale);
    const n = await restoreInBatches('milkSale', sales);
    console.log(`Restored milkSale: ${n}`);
  } else {
    console.log(`milkSale already has ${saleCount} rows, skipping.`);
  }

  console.log('\nFinal counts:');
  console.log('cow:', await prisma.cow.count());
  console.log('milkingRecord:', await prisma.milkingRecord.count());
  console.log('milkSale:', await prisma.milkSale.count());
  await prisma.$disconnect();
})();
