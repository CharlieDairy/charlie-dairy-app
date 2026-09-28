const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

const MODELS = [
  'user', 'moduleAccess', 'cow', 'cowCustomFieldDef', 'cowCustomFieldValue',
  'vaccineDef', 'vaccinationRecord', 'medicineDef', 'treatmentRecord',
  'weightRecord', 'weightStandard', 'cowMovement', 'heatEvent', 'insemination',
  'pregnancyCheck', 'calving', 'calf', 'milkingRecord', 'milkSale',
  'customerPayment', 'employee', 'salaryPayment', 'attendanceRecord',
  'feedTransaction', 'inventoryItem', 'inventoryTransaction', 'cashTransaction',
  'capitalEntry', 'masterDataItem', 'asset', 'auditLog',
];

(async () => {
  const backup = {};
  let totalRows = 0;
  for (const model of MODELS) {
    const rows = await prisma[model].findMany();
    backup[model] = rows;
    totalRows += rows.length;
    console.log(`${model}: ${rows.length} rows`);
  }
  const dir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const file = path.join(dir, `full-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, (_k, v) => v, 2));
  console.log(`\nTotal rows: ${totalRows}`);
  console.log(`Backup written to: ${file}`);
  await prisma.$disconnect();
})();
