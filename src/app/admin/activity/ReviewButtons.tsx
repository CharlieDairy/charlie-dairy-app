"use client";

import { useActionState } from "react";
import { reviewAllPastDays, reviewDay, type FormState } from "./actions";

// Mark one finished day (or every waiting day) as reviewed. The message shows what happened.
export function ReviewDayButton({ day }: { day: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(reviewDay, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="day" value={day} />
      <button type="submit" disabled={pending} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60">
        {pending ? "Saving…" : "Mark this day as reviewed"}
      </button>
      {state && <span className={`text-sm ${state.success ? "text-green-700" : "text-red-600"}`} role="status">{state.message}</span>}
    </form>
  );
}

export function ReviewAllButton({ count }: { count: number }) {
  const [state, action, pending] = useActionState<FormState>(reviewAllPastDays, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={pending || count === 0} className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-text-muted hover:bg-primary-light disabled:opacity-50">
        {pending ? "Saving…" : `Mark all ${count} waiting day${count === 1 ? "" : "s"} as reviewed`}
      </button>
      {state && <span className={`text-xs ${state.success ? "text-green-700" : "text-red-600"}`} role="status">{state.message}</span>}
    </form>
  );
}
