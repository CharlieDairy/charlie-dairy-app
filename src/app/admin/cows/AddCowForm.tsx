"use client";

import { useActionState, useRef, useEffect } from "react";
import { addCow, type FormState } from "./actions";

export default function AddCowForm({ statusOptions }: { statusOptions: { code: string; label: string }[] }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(addCow, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col sm:flex-row gap-3 bg-white border border-neutral-200 rounded-lg p-4 items-end flex-wrap">
      <div className="flex flex-col gap-1">
        <label htmlFor="tag" className="text-sm font-medium text-neutral-700">Tag</label>
        <input id="tag" name="tag" required className="border border-neutral-300 rounded-md px-3 py-2 text-base w-28" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="gender" className="text-sm font-medium text-neutral-700">Gender</label>
        <select id="gender" name="gender" required className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="FEMALE">Female</option>
          <option value="MALE">Male</option>
          <option value="UNKNOWN">Unknown</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="status" className="text-sm font-medium text-neutral-700">Status</label>
        <select id="status" name="status" required className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          {statusOptions.map((o) => (
            <option key={o.code} value={o.code}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
        <label htmlFor="notes" className="text-sm font-medium text-neutral-700">Notes</label>
        <input id="notes" name="notes" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md px-4 py-2 font-medium disabled:opacity-60">
        {isPending ? "Adding…" : "Add Cow"}
      </button>
      {state && (
        <p className={`text-sm w-full ${state.success ? "text-green-700" : "text-red-600"}`}>{state.message}</p>
      )}
    </form>
  );
}
