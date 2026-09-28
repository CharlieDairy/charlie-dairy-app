"use client";

import { useActionState, useRef, useEffect } from "react";
import { addVaccineDef, type FormState } from "../actions";

export default function AddVaccineForm() {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(addVaccineDef, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col sm:flex-row gap-3 bg-white border border-neutral-200 rounded-lg p-4 items-end flex-wrap">
      <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
        <label htmlFor="name" className="text-sm font-medium text-neutral-700">Vaccine Name</label>
        <input id="name" name="name" required placeholder="e.g. FMD" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="repeatIntervalDays" className="text-sm font-medium text-neutral-700">Repeat Every (days, optional)</label>
        <input id="repeatIntervalDays" name="repeatIntervalDays" type="number" min="1" placeholder="e.g. 180" className="border border-neutral-300 rounded-md px-3 py-2 text-base w-40" />
      </div>
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-4 py-2 font-medium disabled:opacity-60">
        {isPending ? "Adding…" : "Add Vaccine"}
      </button>
      {state && (
        <p className={`text-sm w-full ${state.success ? "text-green-700" : "text-red-600"}`}>{state.message}</p>
      )}
    </form>
  );
}
