"use client";

import { useActionState, useRef, useEffect } from "react";
import { addAsset, type FormState } from "./actions";

export default function AddAssetForm() {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(addAsset, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col sm:flex-row gap-3 bg-white border border-neutral-200 rounded-lg p-4 items-end flex-wrap">
      <div className="flex flex-col gap-1">
        <label htmlFor="assetClass" className="text-sm font-medium text-neutral-700">Asset Class</label>
        <input id="assetClass" name="assetClass" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
        <label htmlFor="details" className="text-sm font-medium text-neutral-700">Details</label>
        <input id="details" name="details" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="qty" className="text-sm font-medium text-neutral-700">Qty</label>
        <input id="qty" name="qty" type="number" step="1" min="0" required className="border border-neutral-300 rounded-md px-3 py-2 text-base w-24" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="currentValue" className="text-sm font-medium text-neutral-700">Current Value (Rs)</label>
        <input id="currentValue" name="currentValue" type="number" step="1" min="0" required className="border border-neutral-300 rounded-md px-3 py-2 text-base w-36" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="photo" className="text-sm font-medium text-neutral-700">Photo (optional)</label>
        <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
      </div>
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-4 py-2 font-medium disabled:opacity-60">
        {isPending ? "Adding…" : "Add Asset"}
      </button>
      {state && (
        <p className={`text-sm w-full ${state.success ? "text-green-700" : "text-red-600"}`}>{state.message}</p>
      )}
    </form>
  );
}
