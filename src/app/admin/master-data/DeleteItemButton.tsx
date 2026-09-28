"use client";

import { useActionState } from "react";
import { deleteItem, type FormState } from "./actions";

export default function DeleteItemButton({ id, label }: { id: string; label: string }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(deleteItem, undefined);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Delete "${label}"? This can't be undone.`)) e.preventDefault();
      }}
      className="inline-flex items-center gap-1"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={isPending}
        className="text-xs rounded px-2 py-1 border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? "Deleting…" : "Delete"}
      </button>
      {state && !state.success && <span className="text-xs text-red-600">{state.message}</span>}
    </form>
  );
}
