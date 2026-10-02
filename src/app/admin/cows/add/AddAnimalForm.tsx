"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { addCow, type FormState } from "../actions";

export default function AddAnimalForm({
  statusOptions,
  locations,
  damTags,
}: {
  statusOptions: { code: string; label: string }[];
  locations: string[];
  damTags: string[];
}) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(addCow, undefined);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Add New Animal</h1>
          <p className="text-sm text-neutral-500">Keep animal data tidy with a compact, structured form.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/cows" className="link-btn">
            ← Back to Animals
          </Link>
          <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60">
            {isPending ? "Saving…" : "✓ Save Animal"}
          </button>
        </div>
      </div>

      {state && (
        <p className={`text-sm ${state.success ? "text-green-700" : "text-red-600"}`} role="status">
          {state.message}
        </p>
      )}

      <div className="bg-white border border-neutral-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        <div className="flex flex-col gap-2">
          <div className="w-full aspect-square rounded-md border border-dashed border-neutral-300 bg-neutral-50 flex items-center justify-center overflow-hidden">
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="Preview" className="w-full h-full object-contain" />
            ) : (
              <span className="text-neutral-300 text-sm">No photo</span>
            )}
          </div>
          <label className="bg-green-700 text-white rounded-md px-3 py-2 text-sm font-medium text-center cursor-pointer">
            Upload photo
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setPhotoPreview(URL.createObjectURL(file));
              }}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="tag" className="text-sm font-medium text-neutral-700">Tag # <span className="text-red-500">*</span></label>
            <input id="tag" name="tag" required placeholder="e.g. 108" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="breed" className="text-sm font-medium text-neutral-700">Breed</label>
            <input id="breed" name="breed" placeholder="e.g. Sahiwal" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="gender" className="text-sm font-medium text-neutral-700">Sex <span className="text-red-500">*</span></label>
            <select id="gender" name="gender" required defaultValue="FEMALE" className="border border-neutral-300 rounded-md px-3 py-2 text-base">
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="dateOfBirth" className="text-sm font-medium text-neutral-700">Date of Birth</label>
            <input id="dateOfBirth" name="dateOfBirth" type="date" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="purchasePrice" className="text-sm font-medium text-neutral-700">Purchase Price (Rs, optional)</label>
            <input id="purchasePrice" name="purchasePrice" type="number" step="0.01" min="0" placeholder="0.00" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="purchaseDate" className="text-sm font-medium text-neutral-700">Purchase Date (optional)</label>
            <input id="purchaseDate" name="purchaseDate" type="date" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="damTag" className="text-sm font-medium text-neutral-700">Mother Tag (optional, if born on farm)</label>
            <input id="damTag" name="damTag" list="dam-options" placeholder="e.g. 108" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
            <datalist id="dam-options">
              {damTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="sireTag" className="text-sm font-medium text-neutral-700">Sire Tag (optional)</label>
            <input id="sireTag" name="sireTag" placeholder="e.g. bull tag or name" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="location" className="text-sm font-medium text-neutral-700">Section (optional)</label>
            <input id="location" name="location" list="location-options" placeholder="e.g. Shed 2" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
            <datalist id="location-options">
              {locations.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="status" className="text-sm font-medium text-neutral-700">Status <span className="text-red-500">*</span></label>
            <select id="status" name="status" required className="border border-neutral-300 rounded-md px-3 py-2 text-base">
              {statusOptions.map((o) => (
                <option key={o.code} value={o.code}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor="notes" className="text-sm font-medium text-neutral-700">Notes</label>
            <input id="notes" name="notes" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
        </div>
      </div>
    </form>
  );
}
