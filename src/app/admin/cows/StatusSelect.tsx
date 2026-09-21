"use client";

import { updateCowStatus } from "./actions";

export default function StatusSelect({
  cowId,
  status,
  options,
}: {
  cowId: string;
  status: string;
  options: { code: string; label: string }[];
}) {
  return (
    <form
      action={updateCowStatus}
      onChange={(e) => (e.currentTarget as HTMLFormElement).requestSubmit()}
    >
      <input type="hidden" name="cowId" value={cowId} />
      <select name="status" defaultValue={status} className="border border-neutral-300 rounded px-2 py-1 text-sm">
        {options.map((o) => (
          <option key={o.code} value={o.code}>{o.label}</option>
        ))}
      </select>
    </form>
  );
}
