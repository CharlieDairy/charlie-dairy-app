import { prisma } from "@/lib/prisma";
import { buildBackup, farmStamp } from "@/lib/backup";
import { DriveError, driveConfigured, uploadToDrive } from "@/lib/googleDrive";

/** Weekly backups, so 26 files is about six months of history. */
export const DRIVE_KEEP = 26;

// Each run leaves one Audit Log line, which the Backups page and Farm Watch read to show when the last copy was made.
export const DRIVE_AUDIT = { entity: "GoogleDriveBackup", ok: "backup_ok", failed: "backup_failed" } as const;

/** Builds a full backup and saves it to Google Drive. Throws (after logging the failure) when it cannot. */
export async function runDriveBackup(who: string): Promise<{ name: string; rows: number; kilobytes: number; removed: number }> {
  if (!driveConfigured()) throw new DriveError("Google Drive is not connected yet.");
  try {
    const { gz, total } = await buildBackup();
    const name = `charlie-backup-${farmStamp()}.json.gz`;
    const { removed } = await uploadToDrive(name, gz, DRIVE_KEEP);
    const result = { name, rows: total, kilobytes: Math.round(gz.length / 1024), removed };
    await prisma.auditLog.create({ data: { userName: who, action: DRIVE_AUDIT.ok, entity: DRIVE_AUDIT.entity, newValue: JSON.stringify(result) } });
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message.slice(0, 300) : "backup failed";
    await prisma.auditLog.create({ data: { userName: who, action: DRIVE_AUDIT.failed, entity: DRIVE_AUDIT.entity, newValue: message } }).catch(() => undefined);
    throw e;
  }
}
