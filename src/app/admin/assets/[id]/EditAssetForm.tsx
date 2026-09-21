"use client";

import { useActionState, useRef, useEffect } from "react";
import Image from "next/image";
import { updateAsset, deleteAsset, type FormState } from "../actions";
import type { Asset } from "@prisma/client";

export default function EditAssetForm({ asset }: { asset: Asset }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(updateAsset, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex flex-col gap-6">
      <form ref={formRef} action={formAction} className="flex flex-col gap-4 bg-white border border-neutral-200 rounded-lg p-4">
        <input type="hidden" name="id" value={asset.id} />

        {asset.photoUrl && (
          <div className="flex items-center gap-3">
            <Image src={asset.photoUrl} alt={asset.details} width={120} height={120} className="rounded-md object-cover border border-neutral-200" />
            <label className="flex items-center gap-2 text-sm text-neutral-600">
              <input type="checkbox" name="removePhoto" className="rounded border-neutral-300" />
              Remove current photo
            </label>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="photo" className="text-sm font-medium text-neutral-700">
            {asset.photoUrl ? "Replace photo" : "Add photo"}
          </label>
          <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="assetClass" className="text-sm font-medium text-neutral-700">Asset Class</label>
            <input id="assetClass" name="assetClass" defaultValue={asset.assetClass} required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="details" className="text-sm font-medium text-neutral-700">Details</label>
            <input id="details" name="details" defaultValue={asset.details} required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="qty" className="text-sm font-medium text-neutral-700">Qty</label>
            <input id="qty" name="qty" type="number" step="0.01" min="0" defaultValue={asset.qty} required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="value" className="text-sm font-medium text-neutral-700">Original Value (Rs)</label>
            <input id="value" name="value" type="number" step="1" min="0" defaultValue={asset.value} required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="currentValue" className="text-sm font-medium text-neutral-700">Current Value (Rs)</label>
            <input id="currentValue" name="currentValue" type="number" step="1" min="0" defaultValue={asset.currentValue} required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="depreciationPct" className="text-sm font-medium text-neutral-700">Depreciation %</label>
            <input id="depreciationPct" name="depreciationPct" type="number" step="0.1" min="0" defaultValue={asset.depreciationPct} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="yearLived" className="text-sm font-medium text-neutral-700">Years in Use</label>
            <input id="yearLived" name="yearLived" type="number" step="1" min="0" defaultValue={asset.yearLived} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="valuationDate" className="text-sm font-medium text-neutral-700">Valuation Date</label>
            <input
              id="valuationDate"
              name="valuationDate"
              type="date"
              defaultValue={asset.valuationDate ? asset.valuationDate.toISOString().slice(0, 10) : ""}
              className="border border-neutral-300 rounded-md px-3 py-2 text-base"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-4 py-2 font-medium disabled:opacity-60">
            {isPending ? "Saving…" : "Save Changes"}
          </button>
          {state && <p className={`text-sm ${state.success ? "text-green-700" : "text-red-600"}`}>{state.message}</p>}
        </div>
      </form>

      <form
        action={deleteAsset}
        onSubmit={(e) => {
          if (!confirm(`Delete asset "${asset.details}"? This can't be undone.`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={asset.id} />
        <button type="submit" className="text-sm rounded-md px-4 py-2 border border-red-200 text-red-700 hover:bg-red-50">
          Delete Asset
        </button>
      </form>
    </div>
  );
}
