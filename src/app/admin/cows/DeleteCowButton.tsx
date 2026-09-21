"use client";

import { useActionState, useRef } from "react";
import { deleteCow, type DeleteState } from "./actions";

export default function DeleteCowButton({ cowId, tag }: { cowId: string; tag: string }) {
  const [state, formAction, isPending] = useActionState<DeleteState, FormData>(deleteCow, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <form
        ref={formRef}
        action={formAction}
        onSubmit={(e) => {
          if (!confirm(`Delete cow ${tag}? This can't be undone.`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="cowId" value={cowId} />
        <button
          type="submit"
          disabled={isPending}
          className="text-xs rounded px-2 py-1 border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {isPending ? "Deleting…" : "Delete"}
        </button>
      </form>
      {state && !state.success && <p className="text-xs text-red-600 max-w-[200px]">{state.message}</p>}
    </div>
  );
}
