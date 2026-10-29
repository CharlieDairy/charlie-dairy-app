"use client";

import { useActionState, useRef, useState } from "react";
import { saveDailySheet, type FormState } from "./actions";
import { rowTotal } from "@/lib/dailySheet";

export type CowRow = { id: string; tag: string; m: string; a: string; e: string };
export type CustomerRow = { id: string; name: string; rate: number; litres: string };
export type UseRow = { type: string; label: string; litres: string };
export type FeedRow = { id: string; name: string; unit: string; stock: number; out: string; in: string };

type Props = {
  date: string;
  cows: CowRow[];
  customers: CustomerRow[];
  usage: UseRow[];
  feed: FeedRow[];
  note: string;
  /** changes whenever the saved data for the day changes, so the boxes refill with what was saved */
  version: string;
  groupTotal: number;
  canFeed: boolean;
};

const num = (v: string | null | undefined) => {
  const n = v === null || v === undefined || v.trim() === "" ? 0 : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 });

const inputCls = "w-20 border border-neutral-300 rounded-md px-2 py-1.5 text-right text-base";

export default function DailySheetForm({ date, cows, customers, usage, feed, note, version, groupTotal, canFeed }: Props) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(saveDailySheet, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  const calc = (read: (name: string) => string | null) => {
    const rows: Record<string, number> = {};
    let production = 0;
    for (const c of cows) {
      const t = rowTotal([read(`m_${c.id}_M`), read(`m_${c.id}_A`), read(`m_${c.id}_E`)]);
      rows[c.id] = t;
      production += t;
    }
    const sold = customers.reduce((s, c) => s + num(read(`sale_${c.id}`)), 0);
    const used = usage.reduce((s, u) => s + num(read(`use_${u.type}`)), 0);
    return { rows, production, sold, used };
  };
  const initial = calc((name) => {
    const cow = cows.find((c) => name.startsWith(`m_${c.id}_`));
    if (cow) return cow[name.slice(-1).toLowerCase() as "m" | "a" | "e"];
    const cust = customers.find((c) => name === `sale_${c.id}`);
    if (cust) return cust.litres;
    return usage.find((u) => name === `use_${u.type}`)?.litres ?? null;
  });
  const [totals, setTotals] = useState(initial);

  const recompute = () => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    setTotals(calc((name) => (fd.get(name) as string | null) ?? null));
  };

  const gap = totals.production - totals.sold - totals.used;

  return (
    <form ref={formRef} action={formAction} onInput={recompute} className="flex flex-col gap-5">
      <input type="hidden" name="date" value={date} />
      {groupTotal > 0 && (
        <p className="text-sm bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-amber-900">
          A herd/group milk total of {fmt(groupTotal)} L is also recorded for this day. New cow entries cannot be added for a shift that a group total covers.
        </p>
      )}

      <div key={version} className="flex flex-col gap-5">
        <section className="bg-white border border-neutral-200 rounded-lg p-4">
          <h2 className="font-semibold text-neutral-900 mb-3">1. Milk by cow (litres)</h2>
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr className="text-left text-neutral-500">
                  <th className="pr-3 py-1 font-medium">Tag</th>
                  <th className="px-1 py-1 font-medium text-right">Morning</th>
                  <th className="px-1 py-1 font-medium text-right">Noon</th>
                  <th className="px-1 py-1 font-medium text-right">Evening</th>
                  <th className="pl-3 py-1 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {cows.map((c) => (
                  <tr key={c.id} className="border-t border-neutral-100">
                    <td className="pr-3 py-1 font-medium text-neutral-900">{c.tag}</td>
                    {(["M", "A", "E"] as const).map((s) => (
                      <td key={s} className="px-1 py-1">
                        <input
                          name={`m_${c.id}_${s}`}
                          type="number"
                          step="0.1"
                          min="0"
                          max="200"
                          inputMode="decimal"
                          autoComplete="off"
                          defaultValue={c[s.toLowerCase() as "m" | "a" | "e"]}
                          aria-label={`Tag ${c.tag} ${s === "M" ? "morning" : s === "A" ? "noon" : "evening"} litres`}
                          className={inputCls}
                        />
                      </td>
                    ))}
                    <td className="pl-3 py-1 text-right font-medium tabular-nums">{totals.rows[c.id] ? fmt(totals.rows[c.id]) : ""}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-neutral-300">
                  <td colSpan={4} className="py-2 font-semibold">Production</td>
                  <td className="pl-3 py-2 text-right font-semibold tabular-nums">{fmt(totals.production)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-neutral-500 mt-2">Leave a box empty if nothing was recorded. Another animal? Use Milking Entry.</p>
        </section>

        <section className="bg-white border border-neutral-200 rounded-lg p-4">
          <h2 className="font-semibold text-neutral-900 mb-3">2. Milk sold (as written on the sheet)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {customers.map((c) => (
              <label key={c.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {c.name} <span className="text-neutral-400">(Rs {c.rate})</span>
                </span>
                <input name={`sale_${c.id}`} type="number" step="0.1" min="0" inputMode="decimal" autoComplete="off" defaultValue={c.litres} className={inputCls} />
              </label>
            ))}
          </div>
        </section>

        <section className="bg-white border border-neutral-200 rounded-lg p-4">
          <h2 className="font-semibold text-neutral-900 mb-3">3. Milk used on the farm</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {usage.map((u) => (
              <label key={u.type} className="flex items-center justify-between gap-3 text-sm">
                <span>{u.label}</span>
                <input name={`use_${u.type}`} type="number" step="0.1" min="0" inputMode="decimal" autoComplete="off" defaultValue={u.litres} className={inputCls} />
              </label>
            ))}
          </div>
        </section>

        <section className="bg-white border border-neutral-200 rounded-lg p-4">
          <h2 className="font-semibold text-neutral-900 mb-3">4. Feed</h2>
          {canFeed ? (
            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="pr-3 py-1 font-medium">Feed</th>
                    <th className="px-1 py-1 font-medium text-right">Used today</th>
                    <th className="px-1 py-1 font-medium text-right">Received today</th>
                    <th className="pl-3 py-1 font-medium text-right">In stock</th>
                  </tr>
                </thead>
                <tbody>
                  {feed.map((f) => (
                    <tr key={f.id} className="border-t border-neutral-100">
                      <td className="pr-3 py-1 font-medium text-neutral-900">
                        {f.name} <span className="text-neutral-400 font-normal">({f.unit})</span>
                      </td>
                      <td className="px-1 py-1">
                        <input name={`out_${f.id}`} type="number" step="0.01" min="0" inputMode="decimal" autoComplete="off" defaultValue={f.out} className={inputCls} />
                      </td>
                      <td className="px-1 py-1">
                        <input name={`in_${f.id}`} type="number" step="0.01" min="0" inputMode="decimal" autoComplete="off" defaultValue={f.in} className={inputCls} />
                      </td>
                      <td className={`pl-3 py-1 text-right tabular-nums ${f.stock < 0 ? "text-red-600" : "text-neutral-600"}`}>{fmt(f.stock)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Your account can't record feed.</p>
          )}
        </section>

        <section className="bg-white border border-neutral-200 rounded-lg p-4">
          <h2 className="font-semibold text-neutral-900 mb-3">5. Notes for the day</h2>
          <textarea
            name="note"
            rows={3}
            maxLength={1000}
            defaultValue={note}
            placeholder="e.g. AI of Tag 55 (Florus), silage delivery 980 maund, animal sold"
            className="w-full border border-neutral-300 rounded-md px-3 py-2 text-base"
          />
          <p className="text-xs text-neutral-500 mt-1">Breeding, health and animal sales are still recorded in their own forms; this note is the day's memo.</p>
        </section>
      </div>

      <div className="sticky bottom-0 -mx-1 bg-white/95 backdrop-blur border border-neutral-200 rounded-lg p-3 flex flex-col gap-2 shadow-md">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span>
            Production <b className="tabular-nums">{fmt(totals.production)}</b>
          </span>
          <span>
            Sold <b className="tabular-nums">{fmt(totals.sold)}</b>
          </span>
          <span>
            Used <b className="tabular-nums">{fmt(totals.used)}</b>
          </span>
          <span className={Math.abs(gap) > 5 ? "text-amber-700" : "text-neutral-600"}>
            Not accounted for <b className="tabular-nums">{fmt(gap)}</b>
          </span>
        </div>
        {state && (
          <p className={`text-sm ${state.success ? "text-green-700" : "text-red-600"}`} role="status">
            {state.message}
          </p>
        )}
        <button type="submit" disabled={isPending} className="bg-green-700 text-white rounded-md py-2.5 font-medium disabled:opacity-60">
          {isPending ? "Saving…" : `Save the sheet for ${date}`}
        </button>
      </div>
    </form>
  );
}
