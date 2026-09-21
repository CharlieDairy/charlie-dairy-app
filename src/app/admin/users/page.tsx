import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import AddUserForm from "./AddUserForm";
import RoleSelect from "./RoleSelect";
import ActiveToggle from "./ActiveToggle";
import ResetPasswordForm from "./ResetPasswordForm";

export default async function UsersAdminPage() {
  const session = await auth();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Users &amp; Access</h1>
      <p className="text-sm text-neutral-500 max-w-2xl">
        ADMIN can see and edit everything under Admin. ENTRY can only use the data-entry
        pages. Deactivating an account blocks future logins but keeps their name on past
        records (e.g. &ldquo;entered by&rdquo;). A deactivated user&apos;s existing browser
        session stays valid until it naturally expires or they sign out — this is not an
        instant kill switch.
      </p>
      <AddUserForm />
      <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Username</th>
              <th className="text-left px-3 py-2">Role</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Created</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className="border-t border-neutral-100 align-top">
                  <td className="px-3 py-2 font-medium">
                    {u.name}
                    {isSelf && <span className="ml-1 text-xs text-neutral-400">(you)</span>}
                  </td>
                  <td className="px-3 py-2">{u.username}</td>
                  <td className="px-3 py-2">
                    <RoleSelect userId={u.id} role={u.role} isSelf={isSelf} />
                  </td>
                  <td className="px-3 py-2">
                    <span className={u.active ? "text-green-700" : "text-red-600"}>
                      {u.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-neutral-500">{u.createdAt.toISOString().slice(0, 10)}</td>
                  <td className="px-3 py-2">
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
    </div>
  );
}
