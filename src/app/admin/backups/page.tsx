import { redirect } from "next/navigation";
import { list } from "@vercel/blob";
import { getLiveUser } from "@/lib/access";
import { BACKUP_PREFIX, BACKUP_KEEP } from "@/lib/backup";
import { prisma } from "@/lib/prisma";
import { driveConfigured, DRIVE_FOLDER_NAME } from "@/lib/googleDrive";
import { DRIVE_AUDIT, DRIVE_KEEP } from "@/lib/driveBackup";
import BackupNowButton from "./BackupNowButton";

export const dynamic = "force-dynamic";

const fmtTime = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" }).format(d);

export default async function BackupsPage() {
  const user = await getLiveUser();
  if (user?.role !== "ADMIN") redirect("/admin");

  const driveOn = driveConfigured();
  const [lastOk, lastFail] = await Promise.all([
    prisma.auditLog.findFirst({ where: { entity: DRIVE_AUDIT.entity, action: DRIVE_AUDIT.ok }, orderBy: { createdAt: "desc" } }),
    prisma.auditLog.findFirst({ where: { entity: DRIVE_AUDIT.entity, action: DRIVE_AUDIT.failed }, orderBy: { createdAt: "desc" } }),
  ]);
  const failedSince = lastFail && (!lastOk || lastFail.createdAt > lastOk.createdAt);
  let lastFile = "";
  try {
    lastFile = lastOk?.newValue ? String((JSON.parse(lastOk.newValue) as { name?: string }).name ?? "") : "";
  } catch {
    lastFile = "";
  }

  const token = process.env.BACKUP_BLOB_TOKEN;
  let backups: { pathname: string; size: number; uploadedAt: Date }[] = [];
  let error: string | null = null;
  if (token) {
    try {
      const r = await list({ prefix: BACKUP_PREFIX, token, limit: 1000 });
      backups = r.blobs.map((b) => ({ pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt })).sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    } catch (e) {
      error = e instanceof Error ? e.message.slice(0, 200) : "Could not read the backup store.";
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Cloud backups</h1>
        <p className="text-sm text-neutral-500">
          Every Monday at 2 am (Pakistan time) the whole database is saved automatically to the farm&apos;s Google Drive, in a folder called &quot;{DRIVE_FOLDER_NAME}&quot;. The newest {DRIVE_KEEP} weekly copies are kept (about six months).
        </p>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-neutral-900">Google Drive</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${driveOn ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{driveOn ? "Connected" : "Not connected yet"}</span>
        </div>
        {driveOn ? (
          <>
            <p className="text-sm text-neutral-700">
              {lastOk ? <>Last backup: <b>{fmtTime(lastOk.createdAt)}</b>{lastFile ? ` (${lastFile})` : ""}.</> : "No backup has reached Google Drive yet. The first one runs on Monday, or press the button to make one now."}
            </p>
            {failedSince && lastFail && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                The last attempt failed on {fmtTime(lastFail.createdAt)}: {lastFail.newValue}. If it says the sign-in was rejected, run the connect step again (below).
              </p>
            )}
            <BackupNowButton />
          </>
        ) : (
          <ol className="list-decimal pl-5 text-sm text-neutral-700 flex flex-col gap-1.5">
            <li>In Google Cloud Console (console.cloud.google.com) create a project called &quot;Charlie Dairy&quot; and turn on the <b>Google Drive API</b>.</li>
            <li>Open <b>Google Auth Platform</b>, set it up as <b>External</b>, add your own Gmail address as a test user, then click <b>Publish app</b> (so the connection does not expire after 7 days).</li>
            <li>Under <b>Clients</b> create an <b>OAuth client</b> of type <b>Desktop app</b> and download its JSON file into <code>E:\Charlie</code>.</li>
            <li>Tell Claude the file name. It signs in once with you and saves the connection to Vercel. Nothing is typed or pasted by hand.</li>
          </ol>
        )}
      </section>

      <h2 className="text-lg font-semibold text-neutral-900 -mb-3">Private Blob store (optional second copy)</h2>
      <p className="text-sm text-neutral-500">The newest {BACKUP_KEEP} copies are kept here. Only an Admin can download them.</p>

      {!token && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <b>Not set up yet.</b> In Vercel, open <b>Storage</b>, create a <b>Blob</b> store with <b>Private</b> access and connect it to this project with the
          variable name <code>BACKUP_BLOB_TOKEN</code>. Also add a variable <code>CRON_SECRET</code> (any long random text, 16 characters or more), then redeploy.
        </div>
      )}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {token && !error && (
        <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-100 text-left">
              <tr><th className="px-4 py-2">Saved</th><th className="px-4 py-2">File</th><th className="px-4 py-2 text-right">Size</th><th className="px-4 py-2"></th></tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.pathname} className="border-t border-neutral-100">
                  <td className="px-4 py-2 whitespace-nowrap">{fmtTime(b.uploadedAt)}</td>
                  <td className="px-4 py-2">{b.pathname.slice(BACKUP_PREFIX.length)}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">{(b.size / 1024).toFixed(0)} KB</td>
                  <td className="px-4 py-2 text-right"><a className="link-btn" href={`/api/admin/backups/download?name=${encodeURIComponent(b.pathname)}`}>Download</a></td>
                </tr>
              ))}
              {backups.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-neutral-400">No backup yet. The first one is made tonight.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-neutral-500">A backup is a compressed file (.json.gz) holding every table. Keep downloads private: they contain all farm data and the sign-in password hashes.</p>
    </div>
  );
}
