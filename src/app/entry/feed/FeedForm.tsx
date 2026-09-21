"use client";

import { useActionState, useRef, useEffect } from "react";
import { submitFeed, type FormState } from "./actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function FeedForm({ feedTypes }: { feedTypes: string[] }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(submitFeed, undefined);
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
        <label htmlFor="feedType" className="text-sm font-medium text-neutral-700">Feed Type</label>
        <input id="feedType" name="feedType" list="feed-type-options" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
        <datalist id="feed-type-options">
          {feedTypes.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-neutral-700">Direction</span>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" name="direction" value="IN" defaultChecked /> Inward (received)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="direction" value="OUT" /> Outward (issued)
          </label>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="quantity" className="text-sm font-medium text-neutral-700">Quantity</label>
        <input id="quantity" name="quantity" type="number" step="0.1" min="0" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="rate" className="text-sm font-medium text-neutral-700">Rate per unit (optional)</label>
        <input id="rate" name="rate" type="number" step="0.01" min="0" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
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
