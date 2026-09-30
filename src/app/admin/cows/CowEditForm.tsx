"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { updateCowDetails, type FormState } from "./actions";

export default function CowEditForm({
  cowId,
  breed,
  condition,
  purchasePrice,
  purchaseDate,
  source,
  notes,
  photoUrl,
}: {
  cowId: string;
  breed: string | null;
  condition: string | null;
  purchasePrice: number | null;
  purchaseDate: string | null;
  source: string | null;
  notes: string | null;
  photoUrl: string | null;
}) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(updateCowDetails, undefined);
  const [open, setOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      setOpen(false);
      setPhotoPreview(null);
    }
  }, [state]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs rounded px-2 py-1 border border-border text-text hover:bg-neutral-100"
      >
        Edit Details
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="w-full flex flex-col gap-4 bg-white border border-neutral-200 rounded-lg p-4"
    >
      <input type="hidden" name="id" value={cowId} />
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5">
        <div className="flex flex-col gap-2">
          <div className="w-full aspect-square rounded-md border border-dashed border-neutral-300 bg-neutral-50 flex items-center justify-center overflow-hidden">
            {photoPreview || photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview ?? photoUrl ?? undefined} alt="Cow" className="w-full h-full object-contain" />
            ) : (
              <span className="text-neutral-300 text-sm">No photo</span>
            )}
          </div>
          <label className="bg-green-700 text-white rounded-md px-3 py-2 text-sm font-medium text-center cursor-pointer hover:bg-green-800">
            {photoUrl ? "Change photo" : "Upload photo"}
            <input
              id="photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setPhotoPreview(file ? URL.createObjectURL(file) : null);
              }}
            />
          </label>
          {photoUrl && !photoPreview && (
            <label className="flex items-center gap-2 text-xs text-neutral-500">
              <input type="checkbox" name="removePhoto" /> Remove current photo
            </label>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="breed" className="text-sm font-medium text-neutral-700">Breed</label>
              <input id="breed" name="breed" placeholder="e.g. Sahiwal, Holstein" defaultValue={breed ?? ""} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="condition" className="text-sm font-medium text-neutral-700">Condition</label>
              <input id="condition" name="condition" defaultValue={condition ?? ""} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="purchasePrice" className="text-sm font-medium text-neutral-700">Purchase Price (Rs, optional)</label>
              <input id="purchasePrice" name="purchasePrice" type="number" step="0.01" min="0" defaultValue={purchasePrice ?? ""} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="purchaseDate" className="text-sm font-medium text-neutral-700">Purchase Date (optional)</label>
              <input id="purchaseDate" name="purchaseDate" type="date" defaultValue={purchaseDate ?? ""} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="source" className="text-sm font-medium text-neutral-700">Source (optional)</label>
              <input id="source" name="source" placeholder="e.g. Born on farm, purchased" defaultValue={source ?? ""} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="notes" className="text-sm font-medium text-neutral-700">Notes</label>
            <input id="notes" name="notes" defaultValue={notes ?? ""} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
        </div>
      </div>
      {state && (
        <p className={`text-sm ${state.success ? "text-green-700" : "text-red-600"}`} role="status">
          {state.message}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60">
          {isPending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setPhotoPreview(null); }} className="text-sm text-neutral-500 px-2">
          Cancel
        </button>
      </div>
    </form>
  );
}
