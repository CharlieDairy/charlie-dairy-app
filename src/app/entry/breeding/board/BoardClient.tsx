"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import BreedingBadge from "@/components/BreedingBadge";
import { boardAction, type FormState } from "./actions";

export type BoardRow = {
  id: string;
  tag: string;
  breeding: { code: string; label: string; tone: string; detail: string; needsAction: boolean; days: number | null };
};
export type BoardSection = { key: string; title: string; hint: string; rows: BoardRow[] };

type Kind = "heat" | "ai" | "pregnant" | "open";
const LABEL: Record<Kind, string> = { heat: "Heat seen", ai: "Inseminated", pregnant: "Pregnant", open: "Open (not pregnant)" };

// Which buttons make sense at each stage. A result can also be recorded early (day under 40), shown as secondary.
const BUTTONS: Record<string, Kind[]> = {
  CALVED: ["heat"],
  WAITING_FOR_HEAT: ["heat", "ai"],
  OPEN: ["heat", "ai"],
  NOT_YET_BRED: ["heat", "ai"],
  IN_HEAT: ["ai"],
  INSEMINATED: ["pregnant", "open"],
  CHECK_DUE: ["pregnant", "open"],
  CHECK_OVERDUE: ["pregnant", "open"],
};

function Row({ row, date }: { row: BoardRow; date: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(boardAction, undefined);
  const kinds = BUTTONS[row.breeding.code] ?? [];
  const early = row.breeding.code === "INSEMINATED";
  return (
    <li className="flex flex-col gap-2 border-t border-neutral-100 px-4 py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/admin/cows/${row.id}`} className="font-semibold text-primary hover:underline">Cow {row.tag}</Link>
          <BreedingBadge tag={row.breeding} />
        </div>
        <p className="text-xs text-neutral-500">{row.breeding.detail}</p>
        {state && <p className={`text-xs ${state.success ? "text-green-700" : "text-red-600"}`} role="status">{state.message}</p>}
      </div>
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="cowId" value={row.id} />
        <input type="hidden" name="date" value={date} />
        {kinds.map((k) => {
          const result = k === "pregnant" || k === "open";
          return (
            <button
              key={k}
              type="submit"
              name="kind"
              value={k}
              disabled={pending}
              onClick={(e) => {
                if (result && !confirm(`Cow ${row.tag}: record the pregnancy check as ${k === "pregnant" ? "PREGNANT" : "OPEN (not pregnant)"} on ${date}?`)) e.preventDefault();
              }}
              className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-60 ${
                result && early ? "border border-border bg-white text-text-muted hover:bg-primary-light" : k === "open" ? "border border-border bg-white text-neutral-800 hover:bg-neutral-50" : "bg-green-700 text-white hover:bg-green-800"
              }`}
            >
              {pending ? "Saving…" : LABEL[k]}
            </button>
          );
        })}
        {row.breeding.code === "DUE_TO_CALVE" && (
          <Link href="/entry/breeding/calving" className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white hover:bg-green-800">Record calving</Link>
        )}
      </form>
    </li>
  );
}

export default function BoardClient({ sections, today }: { sections: BoardSection[]; today: string }) {
  const [date, setDate] = useState(today);
  return (
    <div className="flex flex-col gap-6">
      <label className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm">
        <span className="font-medium text-neutral-700">Date for the buttons below</span>
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm" />
        <span className="text-xs text-neutral-500">Today by default. Change it to record something that happened earlier.</span>
      </label>
      {sections.map((s) => (
        <section key={s.key} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-neutral-900">
            {s.title} <span className="ml-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-600">{s.rows.length}</span>
          </h2>
          <p className="text-xs text-neutral-500 -mt-1">{s.hint}</p>
          {s.rows.length === 0 ? (
            <p className="rounded-lg border border-neutral-200 bg-white px-4 py-4 text-sm text-neutral-500">None.</p>
          ) : (
            <ul className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
              {s.rows.map((r) => <Row key={r.id} row={r} date={date} />)}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
