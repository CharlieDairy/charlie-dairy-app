"use client";

import { useActionState, useRef, useEffect } from "react";
import { addFeedItem, type FormState } from "../actions";

export default function AddItemForm() {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(addFeedItem, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
        <label className="text-xs text-neutral-500">Feed Name</label>
        <input name="name" required placeholder="e.g. Silage" className="border border-neutral-300 rounded px-2 py-1 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500">Unit</label>
        <input name="unit" required placeholder="e.g. kg" className="border border-neutral-300 rounded px-2 py-1 text-sm w-28" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500">Category (optional)</label>
        <input name="category" placeholder="e.g. Roughage" className="border border-neutral-300 rounded px-2 py-1 text-sm w-36" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500">Reorder Level (optional)</label>
        <input name="reorderLevel" type="number" step="0.1" min="0" className="border border-neutral-300 rounded px-2 py-1 text-sm w-32" />
      </div>
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded px-3 py-1.5 text-sm font-medium disabled:opacity-60">
        {isPending ? "Adding…" : "Add"}
      </button>
      {state && !state.success && <span className="text-xs text-red-600 w-full">{state.message}</span>}
    </form>
  );
}
