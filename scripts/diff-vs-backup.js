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
  const backupDir = path.join(__dirname, '..', 'backups');
  const files = fs.readdirSync(backupDir).filter(f => f.startsWith('full-backup-'));
  const latest = files.sort().reverse()[0];
  const backup = JSON.parse(fs.readFileSync(path.join(backupDir, latest), 'utf8'));
  console.log('Comparing against backup:', latest, '\n');

  for (const model of MODELS) {
    const current = await prisma[model].count();
    const backedUp = (backup[model] || []).length;
    const marker = current !== backedUp ? '  <-- DIFFERS' : '';
    console.log(`${model}: current=${current} backup=${backedUp}${marker}`);
  }
  await prisma.$disconnect();
})();
