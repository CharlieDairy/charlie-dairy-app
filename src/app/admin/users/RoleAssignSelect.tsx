"use client";

import { setUserAccessRole } from "./actions";

export default function RoleAssignSelect({
  userId,
  accessRoleId,
  roles,
}: {
  userId: string;
  accessRoleId: string | null;
  roles: { id: string; name: string }[];
}) {
  return (
    <form action={setUserAccessRole} onChange={(e) => (e.currentTarget as HTMLFormElement).requestSubmit()}>
      <input type="hidden" name="userId" value={userId} />
      <select name="accessRoleId" defaultValue={accessRoleId ?? ""} className="border border-neutral-300 rounded px-2 py-1 text-sm">
        <option value="">No role (no access)</option>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
    </form>
  );
}
