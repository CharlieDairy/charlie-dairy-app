"use client";

import { useActionState, useRef, useEffect } from "react";
import { addCowMovement, type FormState } from "./actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function MovementForm({ cowId, locations }: { cowId: string; locations: string[] }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(addCowMovement, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex items-end gap-2 flex-wrap">
      <input type="hidden" name="cowId" value={cowId} />
      <div className="flex flex-col gap-1">
        <label htmlFor="moveDate" className="text-xs font-medium text-neutral-700">Date</label>
        <input id="moveDate" name="date" type="date" required defaultValue={todayIso()} className="border border-neutral-300 rounded-md px-2 py-1.5 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="location" className="text-xs font-medium text-neutral-700">Location</label>
        <input id="location" name="location" list="location-options" required placeholder="e.g. Shed 2" className="border border-neutral-300 rounded-md px-2 py-1.5 text-sm" />
        <datalist id="location-options">
          {locations.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
        <label htmlFor="moveNotes" className="text-xs font-medium text-neutral-700">Notes (optional)</label>
        <input id="moveNotes" name="notes" className="border border-neutral-300 rounded-md px-2 py-1.5 text-sm w-full" />
      </div>
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60">
        {isPending ? "Saving…" : "Add"}
      </button>
      {state && !state.success && <p className="text-xs text-red-600 w-full">{state.message}</p>}
    </form>
  );
}
