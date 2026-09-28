"use client";

import { useActionState, useRef, useEffect } from "react";
import { submitMilkUsage, type FormState } from "./actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function MilkUsageForm() {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(submitMilkUsage, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4 bg-white border border-neutral-200 rounded-lg p-4 max-w-md">
      <div className="flex flex-col gap-1">
        <label htmlFor="date" className="text-sm font-medium text-neutral-700">Date</label>
        <input id="date" name="date" type="date" required defaultValue={todayIso()} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-neutral-700">Use Type</span>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" name="type" value="CALF_USE" defaultChecked /> Calf Use
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="type" value="FARM_USE" /> Farm Use
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="type" value="EMPLOYEE_USE" /> Employee Use
          </label>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="litres" className="text-sm font-medium text-neutral-700">Litres</label>
        <input id="litres" name="litres" type="number" step="0.1" min="0" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium text-neutral-700">Notes (optional)</label>
        <input id="notes" name="notes" placeholder="e.g. Calf pen 2, staff ration" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      {state && (
        <p className={`text-sm ${state.success ? "text-green-700" : "text-red-600"}`} role="status">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md py-2 font-medium disabled:opacity-60">
        {isPending ? "Saving…" : "Save Entry"}
      </button>
    </form>
  );
}
