"use client";

import { useActionState, useRef, useEffect } from "react";
import { recordCalving, type FormState } from "./actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function CalvingForm({ cows }: { cows: { id: string; tag: string }[] }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(recordCalving, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4 bg-white border border-neutral-200 rounded-lg p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="damId" className="text-sm font-medium text-neutral-700">Dam (Cow Tag)</label>
        <select id="damId" name="damId" required className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="">Select a cow…</option>
          {cows.map((c) => (
            <option key={c.id} value={c.id}>{c.tag}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="date" className="text-sm font-medium text-neutral-700">Calving Date</label>
        <input id="date" name="date" type="date" required defaultValue={todayIso()} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="sireTag" className="text-sm font-medium text-neutral-700">Sire (optional)</label>
        <input id="sireTag" name="sireTag" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="difficulty" className="text-sm font-medium text-neutral-700">Calving Difficulty</label>
        <select id="difficulty" name="difficulty" required defaultValue="UNASSISTED" className="border border-neutral-300 rounded-md px-3 py-2 text-base">
          <option value="UNASSISTED">Unassisted</option>
          <option value="EASY_PULL">Easy Pull</option>
          <option value="HARD_PULL">Hard Pull</option>
          <option value="VET_ASSISTED">Vet Assisted</option>
          <option value="CAESAREAN">Caesarean</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="assistedBy" className="text-sm font-medium text-neutral-700">Assisted By (optional)</label>
        <input id="assistedBy" name="assistedBy" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" name="retainedPlacenta" className="rounded border-neutral-300" />
        Retained placenta
      </label>
      <div className="flex flex-col gap-1">
        <label htmlFor="complications" className="text-sm font-medium text-neutral-700">Complications (optional)</label>
        <input id="complications" name="complications" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="calfCount" className="text-sm font-medium text-neutral-700">Number of Calves</label>
        <input id="calfCount" name="calfCount" type="number" min="1" defaultValue={1} className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>

      <div className="border-t border-neutral-200 pt-3 flex flex-col gap-4">
        <p className="text-sm font-medium text-neutral-700">Calf details (primary calf — for twins, note the second in remarks below)</p>
        <div className="flex flex-col gap-1">
          <label htmlFor="calfSex" className="text-sm font-medium text-neutral-700">Calf Sex</label>
          <select id="calfSex" name="calfSex" required defaultValue="UNKNOWN" className="border border-neutral-300 rounded-md px-3 py-2 text-base">
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="calfOutcome" className="text-sm font-medium text-neutral-700">Calf Outcome</label>
          <select id="calfOutcome" name="calfOutcome" required defaultValue="ALIVE" className="border border-neutral-300 rounded-md px-3 py-2 text-base">
            <option value="ALIVE">Alive</option>
            <option value="STILLBORN">Stillborn</option>
            <option value="DIED_WITHIN_24H">Died within 24h</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="calfWeight" className="text-sm font-medium text-neutral-700">Birth Weight, kg (optional)</label>
          <input id="calfWeight" name="calfWeight" type="number" step="0.1" min="0" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="calfTag" className="text-sm font-medium text-neutral-700">New Calf Tag (optional — registers as a new animal if alive)</label>
          <input id="calfTag" name="calfTag" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium text-neutral-700">Notes</label>
        <input id="notes" name="notes" className="border border-neutral-300 rounded-md px-3 py-2 text-base" />
      </div>
      {state && (
        <p className={`text-sm ${state.success ? "text-green-700" : "text-red-600"}`} role="status">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md py-2 font-medium disabled:opacity-60">
        {isPending ? "Saving…" : "Save Calving"}
      </button>
    </form>
  );
}
