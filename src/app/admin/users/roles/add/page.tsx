import Link from "next/link";
import AddRoleForm from "./AddRoleForm";

export default function AddRolePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link href="/admin/users/roles" className="text-sm text-neutral-500 hover:text-neutral-700">← Roles</Link>
        <span className="text-sm text-neutral-400">Admin / Users &amp; Access / Roles / Add</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Create Role</h1>
          <p className="text-sm text-neutral-500">Name the role, then choose what its members can do in each module.</p>
        </div>
      </div>

      <AddRoleForm />
    </div>
  );
}
