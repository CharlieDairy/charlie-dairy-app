// Full backup of the live database to Google Drive (and a second copy on E:).
//
//   node scripts/backup-daily.js
//
// Writes one compressed file per run: charlie-backup-YYYY-MM-DD_HHMM.json.gz. Each file is read back and its row counts
// are checked before the run counts as a success. Keeps the newest KEEP files in each folder. Everything it needs comes
// from .env (DATABASE_URL). Exit code is 1 when no copy could be written, so a scheduler can show a failure.
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const TARGETS = [
  process.env.BACKUP_DRIVE_DIR || "G:\\My Drive\\Charlie Backups", // Google Drive for Desktop
  process.env.BACKUP_LOCAL_DIR || "E:\\Charlie Backups",
];
const KEEP = Number(process.env.BACKUP_KEEP || 45);
const LOG = path.join(__dirname, "..", "backups", "backup-daily.log");

// Same list as scripts/backup-full-db.js. Re-check whenever a model is added to prisma/schema.prisma.
// (WatchFinding, WatchRun, WatchReview and PasswordToken are rebuilt by the app and are left out.)
const MODELS = [
  "user", "accessRole", "accessRolePermission", "cow", "cowCustomFieldDef", "cowCustomFieldValue",
  "vaccineDef", "vaccinationRecord", "medicineDef", "treatmentRecord", "medicineStockTransaction",
  "scoringFactor", "healthSchedule", "productionTarget",
  "weightRecord", "weightStandard", "cowMovement", "heatEvent", "insemination",
  "pregnancyCheck", "calving", "calf", "milkingRecord", "milkUsageRecord", "milkSale",
  "customerPayment", "employee", "salaryPayment", "attendanceRecord",
  "feedTransaction", "feedItem", "customer", "vendor", "cashTransaction",
  "capitalEntry", "masterDataItem", "asset", "auditLog",
];

function log(msg) {
  const line = `${new Date().toISOString()}  ${msg}`;
  console.log(line);
  try { fs.mkdirSync(path.dirname(LOG), { recursive: true }); fs.appendFileSync(LOG, line + "\n"); } catch { /* logging must never stop a backup */ }
}

(async () => {
  const prisma = new PrismaClient();
  try {
    const backup = {};
    const counts = {};
    for (const m of MODELS) {
      backup[m] = await prisma[m].findMany();
      counts[m] = backup[m].length;
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const gz = zlib.gzipSync(Buffer.from(JSON.stringify(backup)), { level: 9 });

    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map((p) => [p.type, p.value]));
    const stamp = `${parts.year}-${parts.month}-${parts.day}_${parts.hour}${parts.minute}`; // farm time (Pakistan)
    const name = `charlie-backup-${stamp}.json.gz`;
    let written = 0;
    for (const dir of TARGETS) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, name);
        fs.writeFileSync(file, gz);
        // read it back and compare the row counts
        const back = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString());
        const bad = MODELS.filter((m) => !Array.isArray(back[m]) || back[m].length !== counts[m]);
        if (bad.length) throw new Error(`check failed for: ${bad.join(", ")}`);
        // keep only the newest KEEP backups here
        const old = fs.readdirSync(dir).filter((f) => /^charlie-backup-.*\.json\.gz$/.test(f)).sort().reverse().slice(KEEP);
        for (const f of old) fs.unlinkSync(path.join(dir, f));
        log(`OK  ${file}  (${total} rows, ${(gz.length / 1048576).toFixed(1)} MB${old.length ? `, removed ${old.length} old` : ""})`);
        written++;
      } catch (e) {
        log(`FAILED  ${dir}  ${e.message}`);
      }
    }
    if (!written) process.exitCode = 1;
  } catch (e) {
    log(`FAILED  could not read the database: ${e.message.split("\n").filter(Boolean).pop()}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
