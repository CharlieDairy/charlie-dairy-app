"use client";

import { useActionState, useRef, useEffect } from "react";
import { markAbsence, type FormState } from "@/app/admin/team/actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function MarkAbsenceForm({ employees }: { employees: { id: string; name: string }[] }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(markAbsence, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4 bg-white border border-neutral-200 rounded-lg p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="employeeId" className="text-sm font-medium text-neutral-700">Employee</label>
        <select id="employeeId" name="employeeId" required className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="">Select employee…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="date" className="text-sm font-medium text-neutral-700">Date</label>
        <input id="date" name="date" type="date" required defaultValue={todayIso()} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      {state && (
        <p className={`text-sm ${state.success ? "text-green-700" : "text-red-600"}`} role="status">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={isPending} className="bg-red-600 text-white rounded-md py-2 font-medium disabled:opacity-60 hover:bg-red-700">
        {isPending ? "Saving…" : "Mark Absent"}
      </button>
    </form>
  );
}
