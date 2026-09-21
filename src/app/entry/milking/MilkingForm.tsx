"use client";

import { useActionState, useRef, useEffect } from "react";
import { submitMilking, type FormState } from "./actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function MilkingForm({ cows }: { cows: { id: string; tag: string }[] }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(submitMilking, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4 bg-white border border-neutral-200 rounded-lg p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="date" className="text-sm font-medium text-neutral-700">Date</label>
        <input id="date" name="date" type="date" required defaultValue={todayIso()} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="cowId" className="text-sm font-medium text-neutral-700">Cow Tag</label>
        <select id="cowId" name="cowId" required className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="">Select a cow…</option>
          {cows.map((c) => (
            <option key={c.id} value={c.id}>{c.tag}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="shift" className="text-sm font-medium text-neutral-700">Shift</label>
        <select id="shift" name="shift" required className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="">Select shift…</option>
          <option value="MORNING">Morning</option>
          <option value="AFTERNOON">Afternoon</option>
          <option value="EVENING">Evening</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="litres" className="text-sm font-medium text-neutral-700">Litres</label>
        <input id="litres" name="litres" type="number" step="0.1" min="0" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
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
