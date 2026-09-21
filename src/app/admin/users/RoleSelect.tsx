"use client";

import { setUserRole } from "./actions";

export default function RoleSelect({ userId, role, isSelf }: { userId: string; role: string; isSelf: boolean }) {
  return (
    <form
      action={setUserRole}
      onChange={(e) => (e.currentTarget as HTMLFormElement).requestSubmit()}
    >
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue={role}
        disabled={isSelf}
        title={isSelf ? "You can't change your own role." : undefined}
        className="border border-neutral-300 rounded px-2 py-1 text-sm disabled:bg-neutral-100 disabled:text-neutral-400"
      >
        <option value="ADMIN">ADMIN</option>
        <option value="ENTRY">ENTRY</option>
      </select>
    </form>
  );
}
