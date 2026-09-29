import Link from "next/link";
import { prisma } from "@/lib/prisma";
import DeleteRowButton from "@/components/DeleteRowButton";
import { deleteAccessRole } from "../actions";

function Ic({ children }: { children: React.ReactNode }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const IconEdit = <Ic><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z" /></Ic>;
const IconTrash = <Ic><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></Ic>;

export default async function RolesListPage() {
  const roles = await prisma.accessRole.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { permissions: true, users: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link href="/admin/users" className="text-sm text-neutral-500 hover:text-neutral-700">← Users &amp; Access</Link>
        <span className="text-sm text-neutral-400">Admin / Users &amp; Access / Roles</span>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Roles</h1>
          <p className="text-sm text-neutral-500">Reusable permission sets — create one, then assign it to any number of users.</p>
        </div>
        <Link href="/admin/users/roles/add" className="bg-green-700 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-green-800">
          + Create Role
        </Link>
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-5 py-2.5 font-medium text-neutral-600">Role</th>
              <th className="text-left px-3 py-2.5 font-medium text-neutral-600">Description</th>
              <th className="text-left px-3 py-2.5 font-medium text-neutral-600">Permissions</th>
              <th className="text-left px-3 py-2.5 font-medium text-neutral-600">Assigned</th>
              <th className="text-left px-3 py-2.5 font-medium text-neutral-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id} className="border-t border-neutral-100">
                <td className="px-5 py-3 font-medium">{r.name}</td>
                <td className="px-3 py-3 text-neutral-500">{r.description ?? "—"}</td>
                <td className="px-3 py-3">{r._count.permissions} of 45</td>
                <td className="px-3 py-3">{r._count.users} user{r._count.users === 1 ? "" : "s"}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    <Link href={`/admin/users/roles/${r.id}`} title="Edit" className="p-1.5 rounded border border-neutral-200 text-neutral-500 hover:bg-neutral-100">
                      {IconEdit}
                    </Link>
                    <DeleteRowButton
                      action={deleteAccessRole}
                      hiddenFields={{ id: r.id }}
                      confirmMessage={`Delete role "${r.name}"? This can't be undone.`}
                      icon={IconTrash}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {roles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-neutral-400">No roles yet — create one to start assigning granular permissions.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
