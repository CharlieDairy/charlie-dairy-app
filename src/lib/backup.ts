import { gzipSync } from "node:zlib";
import { prisma } from "@/lib/prisma";

// Same list as scripts/backup-daily.js. Re-check it whenever a model is added to prisma/schema.prisma.
// (WatchFinding, WatchRun, WatchReview and PasswordToken are rebuilt by the app and are left out.)
export const BACKUP_MODELS = [
  "user", "accessRole", "accessRolePermission", "cow", "cowCustomFieldDef", "cowCustomFieldValue",
  "vaccineDef", "vaccinationRecord", "medicineDef", "treatmentRecord", "medicineStockTransaction",
  "scoringFactor", "healthSchedule", "productionTarget",
  "weightRecord", "weightStandard", "cowMovement", "heatEvent", "insemination",
  "pregnancyCheck", "calving", "calf", "milkingRecord", "milkUsageRecord", "milkSale",
  "customerPayment", "employee", "salaryPayment", "attendanceRecord",
  "feedTransaction", "feedItem", "customer", "vendor", "cashTransaction",
  "capitalEntry", "masterDataItem", "asset", "auditLog",
] as const;

type Delegate = { findMany: () => Promise<unknown[]> };

/** Every table as one gzip-compressed JSON document, plus the row counts. */
export async function buildBackup() {
  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  // Two tables at a time: the database allows only a couple of connections per server instance.
  const queue = [...BACKUP_MODELS];
  const worker = async () => {
    for (let m = queue.shift(); m; m = queue.shift()) {
      const rows = await (prisma as unknown as Record<string, Delegate>)[m].findMany();
      data[m] = rows;
      counts[m] = rows.length;
    }
  };
  await Promise.all([worker(), worker()]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const gz = gzipSync(Buffer.from(JSON.stringify(data)), { level: 9 });
  return { gz, counts, total };
}

/** "2026-10-16_0200" in farm time (Pakistan), for backup file names. */
export function farmStamp(now = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day}_${p.hour}${p.minute}`;
}

export const BACKUP_PREFIX = "backups/";
export const BACKUP_KEEP = 45;
