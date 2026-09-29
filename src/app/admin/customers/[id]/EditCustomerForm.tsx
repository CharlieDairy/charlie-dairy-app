"use client";

import { useActionState, useRef, useEffect } from "react";
import { updateCustomer, deleteCustomer, toggleCustomerActive, type FormState } from "../actions";
import type { Customer } from "@prisma/client";

export default function EditCustomerForm({ customer }: { customer: Customer }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(updateCustomer, undefined);
  const [deleteState, deleteAction, isDeleting] = useActionState<FormState, FormData>(deleteCustomer, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex flex-col gap-6">
      <form ref={formRef} action={formAction} className="flex flex-col gap-4 bg-white border border-neutral-200 rounded-lg p-4">
        <input type="hidden" name="id" value={customer.id} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-sm font-medium text-neutral-700">Customer Name</label>
            <input id="name" name="name" defaultValue={customer.name} required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="phone" className="text-sm font-medium text-neutral-700">Phone</label>
            <input id="phone" name="phone" defaultValue={customer.phone ?? ""} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor="address" className="text-sm font-medium text-neutral-700">Address</label>
            <input id="address" name="address" defaultValue={customer.address ?? ""} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="paymentTerms" className="text-sm font-medium text-neutral-700">Payment Terms</label>
            <input id="paymentTerms" name="paymentTerms" defaultValue={customer.paymentTerms ?? ""} placeholder="e.g. Weekly, Net 7, Cash on delivery" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="agreedRate" className="text-sm font-medium text-neutral-700">Agreed Rate (Rs/L)</label>
            <input id="agreedRate" name="agreedRate" type="number" step="0.01" min="0" defaultValue={customer.agreedRate ?? ""} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
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
        <form action={toggleCustomerActive}>
          <input type="hidden" name="id" value={customer.id} />
          <input type="hidden" name="active" value={(!customer.active).toString()} />
          <button
            type="submit"
            className={`text-sm rounded-md px-4 py-2 border ${
              customer.active ? "border-red-200 text-red-700 hover:bg-red-50" : "border-green-200 text-green-700 hover:bg-green-50"
            }`}
          >
            {customer.active ? "Hide Customer" : "Unhide Customer"}
          </button>
        </form>

        <form
          action={deleteAction}
          onSubmit={(e) => {
            if (!confirm(`Delete customer "${customer.name}"? This can't be undone.`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={customer.id} />
          <button type="submit" disabled={isDeleting} className="text-sm rounded-md px-4 py-2 border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60">
            {isDeleting ? "Deleting…" : "Delete Customer"}
          </button>
        </form>
      </div>
      {deleteState && !deleteState.success && <p className="text-sm text-red-600">{deleteState.message}</p>}
    </div>
  );
}
