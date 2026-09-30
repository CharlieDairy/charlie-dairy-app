"use client";

import { useActionState, useRef, useEffect } from "react";
import { addMedicineDef, type FormState } from "../actions";

export default function AddMedicineForm() {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(addMedicineDef, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col sm:flex-row gap-3 bg-white border border-neutral-200 rounded-lg p-4 items-end flex-wrap">
      <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
        <label htmlFor="name" className="text-sm font-medium text-neutral-700">Medicine Name</label>
        <input id="name" name="name" required placeholder="e.g. Oxytetracycline" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="unit" className="text-sm font-medium text-neutral-700">Unit (optional)</label>
        <input id="unit" name="unit" placeholder="e.g. ml" className="border border-neutral-300 rounded-md px-3 py-2 text-base w-28" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="withdrawalDays" className="text-sm font-medium text-neutral-700">Milk Withdrawal Days (optional)</label>
        <input id="withdrawalDays" name="withdrawalDays" type="number" min="0" step="1" placeholder="e.g. 4" className="border border-neutral-300 rounded-md px-3 py-2 text-base w-28" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="reorderLevel" className="text-sm font-medium text-neutral-700">Reorder Level (optional)</label>
        <input id="reorderLevel" name="reorderLevel" type="number" min="0" step="0.1" placeholder="e.g. 50" className="border border-neutral-300 rounded-md px-3 py-2 text-base w-28" />
      </div>
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-4 py-2 font-medium disabled:opacity-60">
        {isPending ? "Adding…" : "Add Medicine"}
      </button>
      {state && (
        <p className={`text-sm w-full ${state.success ? "text-green-700" : "text-red-600"}`}>{state.message}</p>
      )}
    </form>
  );
}
