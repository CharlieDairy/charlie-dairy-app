import { redirect } from "next/navigation";
import { list } from "@vercel/blob";
import { getLiveUser } from "@/lib/access";
import { BACKUP_PREFIX, BACKUP_KEEP } from "@/lib/backup";

export const dynamic = "force-dynamic";

const fmtTime = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" }).format(d);

export default async function BackupsPage() {
  const user = await getLiveUser();
  if (user?.role !== "ADMIN") redirect("/admin");

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
          Every night at 2 am (Pakistan time) the whole database is saved to a private cloud store. The newest {BACKUP_KEEP} are kept. Only an Admin can download them.
        </p>
      </div>

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
