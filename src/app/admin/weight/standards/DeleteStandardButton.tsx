"use client";

import { deleteWeightStandard } from "../actions";

export default function DeleteStandardButton({ id }: { id: string }) {
  return (
    <form action={deleteWeightStandard}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-xs rounded px-2 py-1 border border-red-200 text-red-700 hover:bg-red-50">
        Delete
      </button>
    </form>
  );
}
