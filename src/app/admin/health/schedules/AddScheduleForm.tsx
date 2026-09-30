"use client";

import { useActionState, useRef, useEffect } from "react";
import { addHealthSchedule, type FormState } from "./actions";

export default function AddScheduleForm() {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(addHealthSchedule, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3 bg-white border border-neutral-200 rounded-lg p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-neutral-700">Schedule Name</label>
        <input id="name" name="name" placeholder="e.g. FMD Vaccination" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="type" className="text-sm font-medium text-neutral-700">Type</label>
        <select id="type" name="type" className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="VACCINATION">Vaccination</option>
          <option value="DEWORMING">Deworming</option>
          <option value="CHECKUP">Checkup</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="intervalDays" className="text-sm font-medium text-neutral-700">Repeat Every (days)</label>
        <input id="intervalDays" name="intervalDays" type="number" min="1" step="1" required defaultValue={180} className="border border-neutral-300 rounded-md px-3 py-2 text-base w-32" />
      </div>
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60">
        {isPending ? "Adding…" : "+ Add Schedule"}
      </button>
      {state && !state.success && <p className="text-sm text-red-600 w-full">{state.message}</p>}
    </form>
  );
}
