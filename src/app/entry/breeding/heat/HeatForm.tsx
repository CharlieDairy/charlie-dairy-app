"use client";

import { useActionState, useRef, useEffect } from "react";
import { recordHeat, type FormState } from "./actions";

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function HeatForm({ cows }: { cows: { id: string; tag: string }[] }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(recordHeat, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4 bg-white border border-neutral-200 rounded-lg p-4">
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
        <label htmlFor="detectedAt" className="text-sm font-medium text-neutral-700">Detected At</label>
        <input id="detectedAt" name="detectedAt" type="datetime-local" required defaultValue={nowLocal()} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="detectionMethod" className="text-sm font-medium text-neutral-700">Detection Method</label>
        <select id="detectionMethod" name="detectionMethod" required defaultValue="VISUAL" className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="VISUAL">Visual</option>
          <option value="ACTIVITY_MONITOR">Activity Monitor</option>
          <option value="TAIL_PAINT">Tail Paint</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="intensity" className="text-sm font-medium text-neutral-700">Intensity (optional)</label>
        <input id="intensity" name="intensity" placeholder="Strong / Weak / etc." className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium text-neutral-700">Notes</label>
        <input id="notes" name="notes" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      {state && (
        <p className={`text-sm ${state.success ? "text-green-700" : "text-red-600"}`} role="status">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md py-2 font-medium disabled:opacity-60">
        {isPending ? "Saving…" : "Save Heat Event"}
      </button>
    </form>
  );
}
