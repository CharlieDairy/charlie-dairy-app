"use client";

import { setUserActive } from "./actions";

export default function ActiveToggle({ userId, active, isSelf }: { userId: string; active: boolean; isSelf: boolean }) {
  return (
    <form action={setUserActive}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="active" value={(!active).toString()} />
      <button
        type="submit"
        disabled={isSelf}
        title={isSelf ? "You can't deactivate your own account." : undefined}
        className={`text-sm rounded px-2 py-1 border disabled:opacity-50 disabled:cursor-not-allowed ${
          active
            ? "border-red-200 text-red-700 hover:bg-red-50"
            : "border-green-200 text-green-700 hover:bg-green-50"
        }`}
      >
        {active ? "Deactivate" : "Activate"}
      </button>
    </form>
  );
}
