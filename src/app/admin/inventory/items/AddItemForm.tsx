"use client";

import { useActionState, useRef, useEffect } from "react";
import { addInventoryItem, type FormState } from "../actions";

export default function AddItemForm() {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(addInventoryItem, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col sm:flex-row gap-3 bg-white border border-neutral-200 rounded-lg p-4 items-end flex-wrap">
      <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
        <label htmlFor="name" className="text-sm font-medium text-neutral-700">Item Name</label>
        <input id="name" name="name" required placeholder="e.g. Disinfectant" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="unit" className="text-sm font-medium text-neutral-700">Unit</label>
        <input id="unit" name="unit" required placeholder="e.g. liters, pieces" className="border border-neutral-300 rounded-md px-3 py-2 text-base w-36" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="category" className="text-sm font-medium text-neutral-700">Category (optional)</label>
        <input id="category" name="category" placeholder="e.g. Cleaning, Fuel" className="border border-neutral-300 rounded-md px-3 py-2 text-base w-44" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="reorderLevel" className="text-sm font-medium text-neutral-700">Reorder Level (optional)</label>
        <input id="reorderLevel" name="reorderLevel" type="number" step="0.1" min="0" className="border border-neutral-300 rounded-md px-3 py-2 text-base w-36" />
      </div>
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-4 py-2 font-medium disabled:opacity-60">
        {isPending ? "Adding…" : "Add Item"}
      </button>
      {state && (
        <p className={`text-sm w-full ${state.success ? "text-green-700" : "text-red-600"}`}>{state.message}</p>
      )}
    </form>
  );
}
