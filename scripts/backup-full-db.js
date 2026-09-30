const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

// Kept in sync with every top-level model in prisma/schema.prisma (`grep
// "^model "`) -- this list previously referenced moduleAccess, inventoryItem
// and inventoryTransaction, none of which exist anymore (replaced by
// AccessRole/AccessRolePermission and FeedItem/FeedTransaction respectively),
// so the script threw before writing anything. Re-check this list whenever
// a model is added, renamed or removed.
const MODELS = [
  'user', 'accessRole', 'accessRolePermission', 'cow', 'cowCustomFieldDef', 'cowCustomFieldValue',
  'vaccineDef', 'vaccinationRecord', 'medicineDef', 'treatmentRecord', 'medicineStockTransaction',
  'scoringFactor', 'healthSchedule', 'productionTarget',
  'weightRecord', 'weightStandard', 'cowMovement', 'heatEvent', 'insemination',
  'pregnancyCheck', 'calving', 'calf', 'milkingRecord', 'milkUsageRecord', 'milkSale',
  'customerPayment', 'employee', 'salaryPayment', 'attendanceRecord',
  'feedTransaction', 'feedItem', 'customer', 'vendor', 'cashTransaction',
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
