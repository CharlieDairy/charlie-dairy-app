"use client";

import { useActionState, useEffect, useState } from "react";
import { updateScoringWeights, resetScoringWeights, type FormState } from "../actions";

const FACTOR_DESCRIPTIONS: Record<string, string> = {
  VACCINATION_COMPLIANCE: "How up to date the animal is on its next-due vaccination.",
  TREATMENT_FREQUENCY: "Fewer treatments in the last 90 days scores higher.",
  HEALTH_RECENCY: "How recently a vaccination or treatment was last recorded.",
};

export default function ScoringWeightsForm({ weights }: { weights: { key: string; label: string; weightPct: number }[] }) {
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(weights.map((w) => [w.key, w.weightPct]))
  );
  const [state, formAction, isPending] = useActionState<FormState, FormData>(updateScoringWeights, undefined);
  const [resetState, resetAction, isResetting] = useActionState<FormState, FormData>(resetScoringWeights, undefined);

  // Re-sync local edits to the server's values after a successful save or
  // reset (revalidatePath refreshes `weights`) -- otherwise "Reset to
  // Default" would update the database but leave stale numbers on screen.
  useEffect(() => {
    setValues(Object.fromEntries(weights.map((w) => [w.key, w.weightPct])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weights]);

  const total = Object.values(values).reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
  const isValid = total === 100;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="bg-white border border-neutral-200 rounded-lg divide-y divide-neutral-100">
        {weights.map((w) => (
          <div key={w.key} className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-neutral-900">{w.label}</p>
              <p className="text-xs text-neutral-500">{FACTOR_DESCRIPTIONS[w.key]}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="number"
                name={`weight_${w.key}`}
                min={0}
                max={100}
                step={1}
                value={values[w.key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [w.key]: Number(e.target.value) }))}
                className="border border-neutral-300 rounded-md px-3 py-2 text-base w-20 text-right"
              />
              <span className="text-neutral-500">%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className="font-medium text-neutral-900">Total Weight</p>
          <p className="text-xs text-neutral-500">Must equal 100% to save</p>
        </div>
        <span className={`text-lg font-semibold ${isValid ? "text-green-700" : "text-amber-600"}`}>
          {total}% {isValid ? "✓" : "⚠"}
        </span>
      </div>

      {state && !state.success && <p className="text-sm text-red-600">{state.message}</p>}
      {state?.success && <p className="text-sm text-green-700">{state.message}</p>}
      {resetState?.success && <p className="text-sm text-green-700">{resetState.message}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!isValid || isPending}
          className="bg-green-700 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save Configuration"}
        </button>
        <button
          type="submit"
          formAction={resetAction}
          disabled={isResetting}
          className="border border-neutral-300 text-neutral-700 rounded-md px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
        >
          {isResetting ? "Resetting…" : "Reset to Default"}
        </button>
      </div>
    </form>
  );
}
