"use client";

import { useActionState, useRef, useEffect } from "react";
import { addCustomFieldDef, type FormState } from "./actions";

export default function AddCustomFieldForm() {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(addCustomFieldDef, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col sm:flex-row gap-3 bg-white border border-neutral-200 rounded-lg p-4 items-end flex-wrap">
      <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
        <label htmlFor="label" className="text-sm font-medium text-neutral-700">Field Name</label>
        <input id="label" name="label" required placeholder="e.g. Insurance Policy #" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="fieldType" className="text-sm font-medium text-neutral-700">Type</label>
        <select id="fieldType" name="fieldType" required className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="TEXT">Text</option>
          <option value="NUMBER">Number</option>
          <option value="DATE">Date</option>
        </select>
      </div>
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-4 py-2 font-medium disabled:opacity-60">
        {isPending ? "Adding…" : "Add Field"}
      </button>
      {state && (
        <p className={`text-sm w-full ${state.success ? "text-green-700" : "text-red-600"}`}>{state.message}</p>
      )}
    </form>
  );
}
