import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import AddUserForm from "./AddUserForm";
import RoleSelect from "./RoleSelect";
import ActiveToggle from "./ActiveToggle";
import ResetPasswordForm from "./ResetPasswordForm";
import ModuleToggles from "./ModuleToggles";
import type { ModuleName } from "@/lib/modules";

function Ic({ children }: { children: React.ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const IconShield = <Ic><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Ic>;
const IconUserPlus = <Ic><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></Ic>;
const IconLock = <Ic><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></Ic>;

export default async function UsersAdminPage() {
  const session = await auth();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { moduleAccess: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link href="/admin" className="text-sm text-neutral-500 hover:text-neutral-700">← Dashboard</Link>
        <span className="text-sm text-neutral-400">Admin / Users &amp; Access</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700">
          {IconShield}
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Users &amp; Access</h1>
          <p className="text-sm text-neutral-500">Create accounts and control what each one can see and do.</p>
        </div>
      </div>

      <section className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 border-b border-neutral-100 px-5 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-green-700">{IconUserPlus}</span>
          <h2 className="font-semibold text-neutral-900">Add User</h2>
        </div>
        <div className="p-5">
          <AddUserForm />
        </div>
      </section>

      <section className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-green-700">{IconLock}</span>
            <h2 className="font-semibold text-neutral-900">Users &amp; Permissions</h2>
          </div>
          <span className="text-xs text-neutral-400 hidden sm:inline">Click a module badge to grant or revoke it</span>
        </div>
        <p className="px-5 pt-4 text-sm text-neutral-500 max-w-2xl">
          ADMIN can see and edit everything. ENTRY defaults to Data Entry plus the Dashboard, and can
          be granted access to specific admin sections below — Operations, Financial, People, Admin —
          without becoming a full administrator. Deactivating an account blocks it immediately —
          every save and every page load re-checks the account — and keeps their name on past records.
          Only an Admin can create or change Admin accounts, change roles, or reset an Admin&apos;s
          password; People-module users can manage ENTRY accounts and can only grant modules they hold.
        </p>
        <div className="overflow-x-auto mt-4">
          <table className="min-w-full text-sm">
            <thead className="bg-green-900 text-white">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">Name</th>
                <th className="text-left px-3 py-2.5 font-medium">Username</th>
                <th className="text-left px-3 py-2.5 font-medium">Role</th>
                <th className="text-left px-3 py-2.5 font-medium">Module Access</th>
                <th className="text-left px-3 py-2.5 font-medium">Status</th>
                <th className="text-left px-3 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                const granted = u.moduleAccess.map((m) => m.module) as ModuleName[];
                return (
                  <tr key={u.id} className="border-t border-neutral-100 align-top">
                    <td className="px-5 py-3 font-medium">
                      {u.name}
                      {isSelf && <span className="ml-1 text-xs text-neutral-400">(you)</span>}
                    </td>
                    <td className="px-3 py-3">{u.username}</td>
                    <td className="px-3 py-3">
                      <RoleSelect userId={u.id} role={u.role} isSelf={isSelf} />
                    </td>
                    <td className="px-3 py-3">
                      {u.role === "ADMIN" ? (
                        <span className="text-xs text-neutral-400">All (full admin)</span>
                      ) : (
                        <ModuleToggles userId={u.id} granted={granted} />
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          u.active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${u.active ? "bg-green-600" : "bg-red-500"}`} />
                        {u.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-2 items-start">
                        <ActiveToggle userId={u.id} active={u.active} isSelf={isSelf} />
                        <ResetPasswordForm userId={u.id} username={u.username} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
