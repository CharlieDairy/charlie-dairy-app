"use client";

import { useActionState, useRef, useEffect } from "react";
import { addWeightStandard, type FormState } from "../actions";

export default function AddStandardForm() {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(addWeightStandard, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col sm:flex-row gap-3 bg-white border border-neutral-200 rounded-lg p-4 items-end flex-wrap">
      <div className="flex flex-col gap-1">
        <label htmlFor="breed" className="text-sm font-medium text-neutral-700">Breed (optional)</label>
        <input id="breed" name="breed" placeholder="Any breed if blank" className="border border-neutral-300 rounded-md px-3 py-2 text-base w-40" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="ageMonths" className="text-sm font-medium text-neutral-700">Age (months)</label>
        <input id="ageMonths" name="ageMonths" type="number" min="0" required className="border border-neutral-300 rounded-md px-3 py-2 text-base w-28" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="minWeightKg" className="text-sm font-medium text-neutral-700">Min Weight (kg)</label>
        <input id="minWeightKg" name="minWeightKg" type="number" step="0.1" min="0" required className="border border-neutral-300 rounded-md px-3 py-2 text-base w-28" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="maxWeightKg" className="text-sm font-medium text-neutral-700">Max Weight (kg)</label>
        <input id="maxWeightKg" name="maxWeightKg" type="number" step="0.1" min="0" required className="border border-neutral-300 rounded-md px-3 py-2 text-base w-28" />
      </div>
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-4 py-2 font-medium disabled:opacity-60">
        {isPending ? "Adding…" : "Add Standard"}
      </button>
      {state && (
        <p className={`text-sm w-full ${state.success ? "text-green-700" : "text-red-600"}`}>{state.message}</p>
      )}
    </form>
  );
}
