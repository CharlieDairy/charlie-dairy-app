"use client";

import { useActionState, useRef, useEffect } from "react";
import { updateVendor, deleteVendor, toggleVendorActive, type FormState } from "../actions";
import type { Vendor } from "@prisma/client";

export default function EditVendorForm({ vendor }: { vendor: Vendor }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(updateVendor, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex flex-col gap-6">
      <form ref={formRef} action={formAction} className="flex flex-col gap-4 bg-white border border-neutral-200 rounded-lg p-4">
        <input type="hidden" name="id" value={vendor.id} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-sm font-medium text-neutral-700">Vendor Name</label>
            <input id="name" name="name" defaultValue={vendor.name} required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="phone" className="text-sm font-medium text-neutral-700">Phone</label>
            <input id="phone" name="phone" defaultValue={vendor.phone ?? ""} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor="address" className="text-sm font-medium text-neutral-700">Address</label>
            <input id="address" name="address" defaultValue={vendor.address ?? ""} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="category" className="text-sm font-medium text-neutral-700">Category</label>
            <input id="category" name="category" defaultValue={vendor.category ?? ""} placeholder="e.g. Feed, Medicine, Repairs" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor="notes" className="text-sm font-medium text-neutral-700">Notes</label>
            <input id="notes" name="notes" defaultValue={vendor.notes ?? ""} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-4 py-2 font-medium disabled:opacity-60">
            {isPending ? "Saving…" : "Save Changes"}
          </button>
          {state && <p className={`text-sm ${state.success ? "text-green-700" : "text-red-600"}`}>{state.message}</p>}
        </div>
      </form>

      <div className="flex items-center gap-3">
        <form action={toggleVendorActive}>
          <input type="hidden" name="id" value={vendor.id} />
          <input type="hidden" name="active" value={(!vendor.active).toString()} />
          <button
            type="submit"
            className={`text-sm rounded-md px-4 py-2 border ${
              vendor.active ? "border-red-200 text-red-700 hover:bg-red-50" : "border-green-200 text-green-700 hover:bg-green-50"
            }`}
          >
            {vendor.active ? "Hide Vendor" : "Unhide Vendor"}
          </button>
        </form>

        <form
          action={deleteVendor}
          onSubmit={(e) => {
            if (!confirm(`Delete vendor "${vendor.name}"? This can't be undone.`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={vendor.id} />
          <button type="submit" className="text-sm rounded-md px-4 py-2 border border-red-200 text-red-700 hover:bg-red-50">
            Delete Vendor
          </button>
        </form>
      </div>
    </div>
  );
}
