"use client";

import { useActionState, useRef, useEffect } from "react";
import { submitGroupMilking, type FormState } from "./actions";

export default function GroupMilkingForm({ date }: { date: string }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(submitGroupMilking, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4 bg-white border border-neutral-200 rounded-lg p-4 max-w-sm">
      <input type="hidden" name="date" value={date} />
      <div className="flex flex-col gap-1">
        <label htmlFor="group-shift" className="text-sm font-medium text-neutral-700">Shift</label>
        <select id="group-shift" name="shift" required className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="">Select shift…</option>
          <option value="MORNING">Morning</option>
          <option value="AFTERNOON">Afternoon</option>
          <option value="EVENING">Evening</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="group-litres" className="text-sm font-medium text-neutral-700">Total Litres (whole herd)</label>
        <input id="group-litres" name="litres" type="number" step="0.1" min="0" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <p className="text-xs text-neutral-500">
        For a quick total when there&apos;s no time for per-cow detail. Not attributed to any animal, so it won&apos;t
        show up on Milk Production by Cow, only in herd-wide totals.
      </p>
      {state && (
        <p className={`text-sm ${state.success ? "text-green-700" : "text-red-600"}`} role="status">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={isPending} className="bg-neutral-800 text-white rounded-md py-2 font-medium disabled:opacity-60">
        {isPending ? "Saving…" : "Save Group Total"}
      </button>
    </form>
  );
}
