import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import AddUserForm from "./AddUserForm";
import RoleSelect from "./RoleSelect";
import ActiveToggle from "./ActiveToggle";
import ResetPasswordForm from "./ResetPasswordForm";
import ResetLinkButton from "./ResetLinkButton";

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

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link href="/admin" className="text-sm text-neutral-500 hover:text-neutral-700">← Dashboard</Link>
        <span className="text-sm text-neutral-400">Admin / Users &amp; Access</span>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700">
            {IconShield}
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Users &amp; Access</h1>
            <p className="text-sm text-neutral-500">Invite people and choose their role: Admin, Editor, View Only or Partner.</p>
          </div>
        </div>
      </div>

      <section className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 border-b border-neutral-100 px-5 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-green-700">{IconUserPlus}</span>
          <h2 className="font-semibold text-neutral-900">Invite User</h2>
          <span className="text-xs text-neutral-400">Invite only — only an Admin can create accounts. You get a one-time link to send; they choose their own password.</span>
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
        </div>
        <p className="px-5 pt-4 text-base font-semibold text-neutral-600">
          <b>Admin</b> can see and change everything. <b>Editor</b> can read, add, edit and delete, but
          can&apos;t open the Admin panel, P&amp;L Statement, Balance Sheet, Capital Ledger, Assets or Cash
          Flow, and can&apos;t create customers or set rates. <b>View Only</b> can read everything an Editor
          can, but can&apos;t add, edit or delete anything. <b>Partner</b> is read-only like View Only but can
          also open the P&amp;L Statement, Balance Sheet, Cash Flow, Capital Ledger and Assets; only the Admin
          panel stays closed. Editors and View Only users can do back-date entries. Deactivating an
          account blocks it immediately and keeps their name on past records.
        </p>
        <div className="overflow-x-auto mt-4">
          <table className="min-w-full text-sm">
            <thead className="bg-green-900 text-white">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">Name</th>
                <th className="text-left px-3 py-2.5 font-medium">Username</th>
                <th className="text-left px-3 py-2.5 font-medium">Role</th>
                <th className="text-left px-3 py-2.5 font-medium">Status</th>
                <th className="text-left px-3 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
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
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          u.active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${u.active ? "bg-green-600" : "bg-red-500"}`} />
                        {u.active ? "Active" : "Inactive"}
                      </span>
                      {u.resetRequestedAt && (
                        <span className="ml-2 inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                          Password reset requested
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-2 items-start">
                        <ActiveToggle userId={u.id} active={u.active} isSelf={isSelf} />
                        <ResetLinkButton userId={u.id} requested={!!u.resetRequestedAt} />
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
