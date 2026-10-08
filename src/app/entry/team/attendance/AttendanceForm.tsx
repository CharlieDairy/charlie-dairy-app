"use client";

import { useActionState } from "react";
import { markAttendance, type FormState } from "@/app/admin/team/actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendanceForm({
  employees,
  existing,
}: {
  employees: { id: string; name: string }[];
  existing: Map<string, string>;
}) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(markAttendance, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4 bg-white border border-neutral-200 rounded-lg p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="date" className="text-sm font-medium text-neutral-700">Date</label>
        <input id="date" name="date" type="date" required defaultValue={todayIso()} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>

      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-neutral-500">
            <th className="text-left py-1 font-normal">Employee</th>
            <th className="text-left py-1 font-normal">Status</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.id} className="border-t border-neutral-100">
              <td className="py-2 font-medium">
                <input type="hidden" name="employeeId" value={e.id} />
                {e.name}
              </td>
              <td className="py-2">
                <select name={`status_${e.id}`} defaultValue={existing.get(e.id) ?? "PRESENT"} className="border border-neutral-300 rounded-md px-2 py-1 text-sm">
                  <option value="PRESENT">Present</option>
                  <option value="ABSENT">Absent</option>
                  <option value="HALF_DAY">Half Day</option>
                  <option value="LEAVE">Leave</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>

      {employees.length === 0 && <p className="text-sm text-neutral-400">No active employees to mark attendance for.</p>}

      {state && (
        <p className={`text-sm ${state.success ? "text-green-700" : "text-red-600"}`} role="status">
          {state.message}
        </p>
      )}
      {employees.length > 0 && (
        <button type="submit" disabled={isPending} className="self-start bg-green-700 text-white rounded-md px-4 py-2 font-medium disabled:opacity-60">
          {isPending ? "Saving…" : "Save Attendance"}
        </button>
      )}
    </form>
  );
}
