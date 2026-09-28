"use client";

import { useActionState, useRef, useEffect } from "react";
import { addWeightRecord, type FormState } from "./actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function WeightForm({ cowId }: { cowId: string }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(addWeightRecord, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex items-end gap-2 flex-wrap">
      <input type="hidden" name="cowId" value={cowId} />
      <div className="flex flex-col gap-1">
        <label htmlFor="weightDate" className="text-xs font-medium text-neutral-700">Date</label>
        <input id="weightDate" name="date" type="date" required defaultValue={todayIso()} className="border border-neutral-300 rounded-md px-2 py-1.5 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="weightKg" className="text-xs font-medium text-neutral-700">Weight (kg)</label>
        <input id="weightKg" name="weightKg" type="number" step="0.1" min="0" required className="border border-neutral-300 rounded-md px-2 py-1.5 text-sm w-28" />
      </div>
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60">
        {isPending ? "Saving…" : "Add"}
      </button>
      {state && !state.success && <p className="text-xs text-red-600 w-full">{state.message}</p>}
    </form>
  );
}
