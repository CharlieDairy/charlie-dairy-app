"use client";

import { useActionState, useRef, useEffect } from "react";
import { recordInventoryTransaction, type FormState } from "@/app/admin/inventory/actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function InventoryForm({ items }: { items: { id: string; name: string; unit: string }[] }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(recordInventoryTransaction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4 bg-white border border-neutral-200 rounded-lg p-4 max-w-md">
      <div className="flex flex-col gap-1">
        <label htmlFor="date" className="text-sm font-medium text-neutral-700">Date</label>
        <input id="date" name="date" type="date" required defaultValue={todayIso()} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="itemId" className="text-sm font-medium text-neutral-700">Item</label>
        <select id="itemId" name="itemId" required className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="">Select an item…</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-neutral-700">Direction</span>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" name="direction" value="IN" defaultChecked /> Inward (received)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="direction" value="OUT" /> Outward (used)
          </label>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="quantity" className="text-sm font-medium text-neutral-700">Quantity</label>
        <input id="quantity" name="quantity" type="number" step="0.1" min="0" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="cost" className="text-sm font-medium text-neutral-700">Cost (Rs, optional)</label>
        <input id="cost" name="cost" type="number" step="0.01" min="0" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium text-neutral-700">Notes (optional)</label>
        <input id="notes" name="notes" placeholder="e.g. Stock take adjustment" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
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
