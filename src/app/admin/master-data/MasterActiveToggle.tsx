"use client";

import { toggleActive } from "./actions";

export default function MasterActiveToggle({ id, active }: { id: string; active: boolean }) {
  return (
    <form action={toggleActive}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={(!active).toString()} />
      <button
        type="submit"
        className={`text-xs rounded px-2 py-1 border ${
          active ? "border-red-200 text-red-700 hover:bg-red-50" : "border-green-200 text-green-700 hover:bg-green-50"
        }`}
      >
        {active ? "Hide" : "Unhide"}
      </button>
    </form>
  );
}
