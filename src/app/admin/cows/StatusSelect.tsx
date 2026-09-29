"use client";

import { useActionState } from "react";
import { updateCowStatus, type FormState } from "./actions";

export default function StatusSelect({
  cowId,
  status,
  options,
}: {
  cowId: string;
  status: string;
  options: { code: string; label: string }[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(updateCowStatus, undefined);

  return (
    <div className="flex flex-col items-start gap-0.5">
      <form
        action={formAction}
        onChange={(e) => (e.currentTarget as HTMLFormElement).requestSubmit()}
      >
        <input type="hidden" name="cowId" value={cowId} />
        <select name="status" defaultValue={status} className="border border-neutral-300 rounded px-2 py-1 text-sm">
          {options.map((o) => (
            <option key={o.code} value={o.code}>{o.label}</option>
          ))}
        </select>
      </form>
      {state && !state.success && <p className="text-xs text-red-600">{state.message}</p>}
    </div>
  );
}
