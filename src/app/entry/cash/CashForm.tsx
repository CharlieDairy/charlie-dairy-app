"use client";

import { useActionState, useRef, useEffect } from "react";
import { submitCash, type FormState } from "./actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function CashForm({ categories }: { categories: string[] }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(submitCash, undefined);
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
        <span className="text-sm font-medium text-neutral-700">Direction</span>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" name="direction" value="IN" defaultChecked /> Cash In
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="direction" value="OUT" /> Cash Out
          </label>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="amount" className="text-sm font-medium text-neutral-700">Amount (Rs)</label>
        <input id="amount" name="amount" type="number" step="1" min="0" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="category" className="text-sm font-medium text-neutral-700">Category</label>
        <input id="category" name="category" list="category-options" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
        <datalist id="category-options">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="party" className="text-sm font-medium text-neutral-700">Party (optional)</label>
        <input id="party" name="party" type="text" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="remark" className="text-sm font-medium text-neutral-700">Remark</label>
        <input id="remark" name="remark" type="text" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
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
