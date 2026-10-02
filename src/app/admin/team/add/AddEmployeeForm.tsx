"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { addEmployee, type FormState } from "../actions";

export default function AddEmployeeForm() {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(addEmployee, undefined);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Add New Employee</h1>
          <p className="text-sm text-neutral-500">Keep staff records tidy with a compact, structured form.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/team" className="link-btn">
            ← Back to Team
          </Link>
          <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60">
            {isPending ? "Saving…" : "✓ Save Employee"}
          </button>
        </div>
      </div>

      {state && !state.success && (
        <p className="text-sm text-red-600" role="status">{state.message}</p>
      )}

      <div className="bg-white border border-neutral-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        <div className="flex flex-col gap-2">
          <div className="w-full aspect-square rounded-md border border-dashed border-neutral-300 bg-neutral-50 flex items-center justify-center overflow-hidden">
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
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
            <label htmlFor="name" className="text-sm font-medium text-neutral-700">Name <span className="text-red-500">*</span></label>
            <input id="name" name="name" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="position" className="text-sm font-medium text-neutral-700">Position</label>
            <input id="position" name="position" placeholder="e.g. Milker, Helper" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="phone" className="text-sm font-medium text-neutral-700">Phone</label>
            <input id="phone" name="phone" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="joinDate" className="text-sm font-medium text-neutral-700">Join Date</label>
            <input id="joinDate" name="joinDate" type="date" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="monthlySalary" className="text-sm font-medium text-neutral-700">Monthly Salary (Rs, optional)</label>
            <input id="monthlySalary" name="monthlySalary" type="number" step="0.01" min="0" placeholder="0.00" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
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
