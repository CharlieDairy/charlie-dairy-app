"use client";

import { useActionState, useRef, useEffect } from "react";
import { addItem, type FormState } from "./actions";

export default function AddItemForm({ category }: { category: string }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(addItem, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="category" value={category} />
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500">Code</label>
        <input name="code" required placeholder="e.g. SILAGE" className="border border-neutral-300 rounded px-2 py-1 text-sm w-36" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500">Label</label>
        <input name="label" required placeholder="e.g. Silage" className="border border-neutral-300 rounded px-2 py-1 text-sm w-36" />
      </div>
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded px-3 py-1.5 text-sm font-medium disabled:opacity-60">
        {isPending ? "Adding…" : "Add"}
      </button>
      {state && !state.success && <span className="text-xs text-red-600">{state.message}</span>}
    </form>
  );
}
