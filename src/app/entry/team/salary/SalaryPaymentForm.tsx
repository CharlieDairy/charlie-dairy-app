"use client";

import { useActionState, useRef, useEffect } from "react";
import { recordSalaryPayment, type FormState } from "@/app/admin/team/actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function SalaryPaymentForm({ employees }: { employees: { id: string; name: string; monthlySalary: number | null }[] }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(recordSalaryPayment, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4 bg-white border border-neutral-200 rounded-lg p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="date" className="text-sm font-medium text-neutral-700">Date</label>
        <input id="date" name="date" type="date" required defaultValue={todayIso()} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="employeeId" className="text-sm font-medium text-neutral-700">Employee</label>
        <select id="employeeId" name="employeeId" required className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="">Select an employee…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name}{e.monthlySalary ? ` (Rs ${e.monthlySalary.toLocaleString()}/mo)` : ""}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="forMonth" className="text-sm font-medium text-neutral-700">For Month (optional)</label>
        <input id="forMonth" name="forMonth" type="month" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="amount" className="text-sm font-medium text-neutral-700">Amount (Rs)</label>
        <input id="amount" name="amount" type="number" step="0.01" min="0" required className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-neutral-700">Mode</span>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" value="CASH" defaultChecked /> Cash
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" value="BANK" /> Bank
          </label>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium text-neutral-700">Notes (optional)</label>
        <input id="notes" name="notes" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      {state && (
        <p className={`text-sm ${state.success ? "text-green-700" : "text-red-600"}`} role="status">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md py-2 font-medium disabled:opacity-60">
        {isPending ? "Saving…" : "Save Entry"}
      </button>
    </form>
  );
}
