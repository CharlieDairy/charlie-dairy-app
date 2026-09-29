"use client";

import { useActionState } from "react";
import { updateAccessRole, type FormState } from "../../actions";
import RolePermissionMatrix from "../RolePermissionMatrix";
import type { AccessRole } from "@prisma/client";

export default function EditRoleForm({ role, initialGrants }: { role: AccessRole; initialGrants: string[] }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(updateAccessRole, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="id" value={role.id} />

      <section className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 border-b border-neutral-100 px-5 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-green-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </span>
          <h2 className="font-semibold text-neutral-900">Role details</h2>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-sm font-medium text-neutral-700">Role name <span className="text-red-500">*</span></label>
            <input id="name" name="name" required defaultValue={role.name} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="description" className="text-sm font-medium text-neutral-700">Description</label>
            <textarea id="description" name="description" rows={1} defaultValue={role.description ?? ""} className="border border-neutral-300 rounded-md px-3 py-2 text-base resize-y" />
          </div>
        </div>
      </section>

      <section className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 border-b border-neutral-100 px-5 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-green-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </span>
          <h2 className="font-semibold text-neutral-900">Permissions</h2>
        </div>
        <div className="p-5">
          <RolePermissionMatrix initialGrants={initialGrants} />
        </div>
      </section>

      {state && (
        <p className={`text-sm ${state.success ? "text-green-700" : "text-red-600"}`}>{state.message}</p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-5 py-2.5 text-sm font-medium disabled:opacity-60 hover:bg-green-800">
          {isPending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
