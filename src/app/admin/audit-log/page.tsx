import { getAuditLogPage, getAuditLogFilters } from "@/lib/reports/auditLog";
import Link from "next/link";

function fmtDateTime(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function buildHref(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const qs = sp.toString();
  return `/admin/audit-log${qs ? `?${qs}` : ""}`;
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; entity?: string; user?: string }>;
}) {
  const params = await searchParams;
  const page = params.page ? parseInt(params.page, 10) || 1 : 1;
  const entity = params.entity || undefined;
  const user = params.user || undefined;

  const [{ rows, totalPages, total }, filters] = await Promise.all([
    getAuditLogPage({ page, entity, user }),
    getAuditLogFilters(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Audit Log</h1>
      <p className="text-sm text-neutral-500 max-w-2xl">
        Every create, update and delete made by any user, anywhere in the app, is recorded here automatically —
        admin-only. {total.toLocaleString()} entries total.
      </p>

      <form className="flex flex-wrap items-end gap-3 bg-white border border-neutral-200 rounded-lg p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">Entity</label>
          <select name="entity" defaultValue={entity ?? ""} className="border border-neutral-300 rounded-md px-2 py-1 text-sm">
            <option value="">All</option>
            {filters.entities.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">User</label>
          <select name="user" defaultValue={user ?? ""} className="border border-neutral-300 rounded-md px-2 py-1 text-sm">
            <option value="">All</option>
            {filters.users.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="bg-green-700 text-white rounded-md px-4 py-1.5 text-sm font-medium">
          Filter
        </button>
        {(entity || user) && (
          <Link href="/admin/audit-log" className="text-sm text-neutral-500 underline">
            Clear
          </Link>
        )}
      </form>

      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Time</th>
              <th className="text-left px-3 py-2">User</th>
              <th className="text-left px-3 py-2">Action</th>
              <th className="text-left px-3 py-2">Entity</th>
              <th className="text-left px-3 py-2">Record</th>
              <th className="text-left px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-neutral-100 align-top">
                <td className="px-3 py-2 text-neutral-500 whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                <td className="px-3 py-2">{r.userName ?? <span className="text-neutral-400">System</span>}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      r.action === "delete" || r.action === "deleteMany"
                        ? "text-red-600"
                        : r.action === "create" || r.action === "createMany"
                          ? "text-green-700"
                          : "text-neutral-700"
                    }
                  >
                    {r.action}
                  </span>
                </td>
                <td className="px-3 py-2">{r.entity}</td>
                <td className="px-3 py-2 font-mono text-xs text-neutral-500">{r.entityId ?? "—"}</td>
                <td className="px-3 py-2">
                  {(r.oldValue || r.newValue) ? (
                    <details>
                      <summary className="cursor-pointer text-neutral-500 text-xs">view</summary>
                      <div className="mt-1 space-y-1 max-w-md">
                        {r.oldValue && (
                          <div>
                            <p className="text-xs font-medium text-neutral-500">Before</p>
                            <pre className="text-xs bg-neutral-50 p-1 rounded overflow-x-auto">{r.oldValue}</pre>
                          </div>
                        )}
                        {r.newValue && (
                          <div>
                            <p className="text-xs font-medium text-neutral-500">After</p>
                            <pre className="text-xs bg-neutral-50 p-1 rounded overflow-x-auto">{r.newValue}</pre>
                          </div>
                        )}
                      </div>
                    </details>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-neutral-400">No entries match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={buildHref({ page: page - 1, entity, user })} className="underline">
              ← Previous
            </Link>
          )}
          {page < totalPages && (
            <Link href={buildHref({ page: page + 1, entity, user })} className="underline">
              Next →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
