"use client";

import { updateCowStatus } from "./actions";

const STATUSES = ["MILKING", "DRY", "HEIFER", "CALF", "DORMANT", "SOLD", "DEAD"];

export default function StatusSelect({ cowId, status }: { cowId: string; status: string }) {
  return (
    <form
      action={updateCowStatus}
      onChange={(e) => (e.currentTarget as HTMLFormElement).requestSubmit()}
    >
      <input type="hidden" name="cowId" value={cowId} />
      <select name="status" defaultValue={status} className="border border-neutral-300 rounded px-2 py-1 text-sm">
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </form>
  );
}
