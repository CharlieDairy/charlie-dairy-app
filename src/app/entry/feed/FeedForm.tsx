"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { submitFeed, type FormState } from "./actions";

type Item = { name: string; unit: string };

export default function FeedForm({ items, stock, today }: { items: Item[]; stock: Record<string, number>; today: string }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(submitFeed, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [feed, setFeed] = useState("");
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      setFeed("");
      setDirection("IN");
    }
  }, [state]);

  const item = items.find((i) => i.name === feed);
  const onHand = item ? stock[item.name] ?? 0 : null;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4 bg-white border border-neutral-200 rounded-lg p-4 max-w-2xl">
      <div className="flex flex-col gap-1">
        <label htmlFor="date" className="text-sm font-medium text-neutral-700">Date</label>
        <input id="date" name="date" type="date" required defaultValue={today} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="feedType" className="text-sm font-medium text-neutral-700">Feed</label>
        <select
          id="feedType"
          name="feedType"
          required
          value={feed}
          onChange={(e) => setFeed(e.target.value)}
          className="border border-neutral-300 rounded-md px-3 py-2 text-base bg-white"
        >
          <option value="">Select a feed…</option>
          {items.map((i) => (
            <option key={i.name} value={i.name}>
              {i.name} ({i.unit})
            </option>
          ))}
        </select>
        {item && onHand !== null && (
          <p className={`text-sm font-medium ${onHand < 0 ? "text-red-600" : "text-neutral-600"}`}>
            In stock now: {onHand.toLocaleString(undefined, { maximumFractionDigits: 1 })} {item.unit}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-neutral-700">Direction</span>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" name="direction" value="IN" checked={direction === "IN"} onChange={() => setDirection("IN")} /> Inward (received)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="direction" value="OUT" checked={direction === "OUT"} onChange={() => setDirection("OUT")} /> Outward (issued)
          </label>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="quantity" className="text-sm font-medium text-neutral-700">Quantity{item ? ` (${item.unit})` : ""}</label>
          <input id="quantity" name="quantity" type="number" step="0.01" min="0" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="rate" className="text-sm font-medium text-neutral-700">
            Rate per {item ? item.unit : "unit"} (optional)
          </label>
          <input id="rate" name="rate" type="number" step="0.01" min="0" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium text-neutral-700">Notes (optional)</label>
        <input id="notes" name="notes" maxLength={300} placeholder="e.g. supplier, brand, ration" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
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
