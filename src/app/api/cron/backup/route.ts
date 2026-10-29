import { put, list, del } from "@vercel/blob";
import { isAuthorisedCron } from "@/lib/cronAuth";
import { buildBackup, farmStamp, BACKUP_PREFIX, BACKUP_KEEP } from "@/lib/backup";
import { driveConfigured } from "@/lib/googleDrive";
import { runDriveBackup } from "@/lib/driveBackup";

// Weekly cloud backup, started by Vercel Cron (see vercel.json). The whole database is saved as one compressed file
//  - to the farm's Google Drive ("Charlie Backups" folder) when Google Drive is connected, and
//  - to a PRIVATE Blob store when BACKUP_BLOB_TOKEN is set (the farm's public photo store cannot hold private files).
// Each destination is tried on its own, so one failing never stops the other. The route only reports an error when
// no destination is set up or every destination failed.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function toBlob(token: string) {
  const { gz, total } = await buildBackup();
  const name = `${BACKUP_PREFIX}charlie-backup-${farmStamp()}.json.gz`;
  await put(name, gz, { access: "private", token, contentType: "application/gzip", allowOverwrite: true, addRandomSuffix: false });

  const all = await list({ prefix: BACKUP_PREFIX, token, limit: 1000 });
  const newestFirst = [...all.blobs].sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  const old = newestFirst.slice(BACKUP_KEEP);
  if (old.length) await del(old.map((b) => b.url), { token });
  return { name, rows: total, kilobytes: Math.round(gz.length / 1024), kept: Math.min(BACKUP_KEEP, newestFirst.length), removed: old.length };
}

export async function GET(req: Request) {
  if (!isAuthorisedCron(req)) return new Response("Unauthorized", { status: 401 });

  const blobToken = process.env.BACKUP_BLOB_TOKEN;
  if (!driveConfigured() && !blobToken) {
    return Response.json(
      { ok: false, error: "No backup destination is set up. Connect Google Drive (Admin > Cloud backups) or set BACKUP_BLOB_TOKEN (see docs/DEPLOYMENT.md)." },
      { status: 503 }
    );
  }

  const report: Record<string, unknown> = {};
  let failed = 0;
  let attempted = 0;

  if (driveConfigured()) {
    attempted++;
    try {
      report.drive = await runDriveBackup("Weekly backup (automatic)");
    } catch (e) {
      failed++;
      console.error("[backup] Google Drive failed", e);
      report.drive = { error: e instanceof Error ? e.message.slice(0, 300) : "backup failed" };
    }
  }
  if (blobToken) {
    attempted++;
    try {
      report.blob = await toBlob(blobToken);
    } catch (e) {
      failed++;
      console.error("[backup] Blob store failed", e);
      report.blob = { error: e instanceof Error ? e.message.slice(0, 300) : "backup failed" };
    }
  }

  return Response.json({ ok: failed < attempted, ...report }, { status: failed === attempted ? 500 : 200 });
}
