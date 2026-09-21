"use client";

import { useActionState, useRef } from "react";
import { updateLabel, type FormState } from "./actions";

export default function LabelEditor({ id, label }: { id: string; label: string }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(updateLabel, undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input
        ref={inputRef}
        name="label"
        defaultValue={label}
        className="border border-neutral-300 rounded px-2 py-1 text-sm w-40"
      />
      <button type="submit" disabled={isPending} className="text-sm text-green-700 hover:underline disabled:opacity-50">
        {isPending ? "Saving…" : "Save"}
      </button>
      {state && !state.success && <span className="text-xs text-red-600">{state.message}</span>}
    </form>
  );
}
