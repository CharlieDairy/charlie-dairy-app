"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";

type ActionState = { success: boolean; message: string } | undefined;

// A delete button for a table row, backed by a runAction()-wrapped server
// action -- those never throw to the caller, they resolve to
// { success: false, message } (e.g. "can't delete, has history"), so this
// needs useActionState to read and show that message, unlike a plain
// <form action={fn}> which only works for actions with no return value.
export default function DeleteRowButton({
  action,
  hiddenFields,
  confirmMessage,
  icon,
  title = "Delete",
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  hiddenFields: Record<string, string>;
  confirmMessage: string;
  icon: ReactNode;
  title?: string;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(action, undefined);

  return (
    <div className="relative inline-block">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!confirm(confirmMessage)) e.preventDefault();
        }}
      >
        {Object.entries(hiddenFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <button
          type="submit"
          disabled={isPending}
          title={title}
          className="p-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          {icon}
        </button>
      </form>
      {state && !state.success && (
        <p className="absolute right-0 top-full mt-1 z-10 w-56 text-xs text-red-600 bg-white border border-red-200 rounded-md px-2 py-1.5 shadow-md">
          {state.message}
        </p>
      )}
    </div>
  );
}
