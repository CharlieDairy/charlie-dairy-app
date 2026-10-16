import { put, list, del } from "@vercel/blob";
import { isAuthorisedCron } from "@/lib/cronAuth";
import { buildBackup, farmStamp, BACKUP_PREFIX, BACKUP_KEEP } from "@/lib/backup";

// Nightly cloud backup, started by Vercel Cron (see vercel.json). The whole database is saved as one compressed
// file in a PRIVATE Blob store (the farm's public photo store cannot hold private files), and only the newest
// BACKUP_KEEP backups are kept.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAuthorisedCron(req)) return new Response("Unauthorized", { status: 401 });

  const token = process.env.BACKUP_BLOB_TOKEN;
  if (!token) {
    return Response.json(
      { ok: false, error: "BACKUP_BLOB_TOKEN is not set. Create a private Blob store in Vercel and connect it to this project (see docs/DEPLOYMENT.md)." },
      { status: 503 }
    );
  }

  try {
    const { gz, total } = await buildBackup();
    const name = `${BACKUP_PREFIX}charlie-backup-${farmStamp()}.json.gz`;
    await put(name, gz, { access: "private", token, contentType: "application/gzip", allowOverwrite: true, addRandomSuffix: false });

    const all = await list({ prefix: BACKUP_PREFIX, token, limit: 1000 });
    const newestFirst = [...all.blobs].sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    const old = newestFirst.slice(BACKUP_KEEP);
    if (old.length) await del(old.map((b) => b.url), { token });

    return Response.json({ ok: true, name, rows: total, kilobytes: Math.round(gz.length / 1024), kept: Math.min(BACKUP_KEEP, newestFirst.length), removed: old.length });
  } catch (e) {
    console.error("[backup] failed", e);
    return Response.json({ ok: false, error: e instanceof Error ? e.message.slice(0, 300) : "backup failed" }, { status: 500 });
  }
}
