"use client";

import { useActionState, useRef, useState } from "react";
import { saveDailySheet, type FormState } from "./actions";
import { rowTotal } from "@/lib/dailySheet";
import PhotoFill from "./PhotoFill";

export type CowRow = { id: string; tag: string; m: string; a: string; e: string };
export type CustomerRow = { id: string; name: string; rate: number; litres: string };
export type UseRow = { type: string; label: string; litres: string };
export type FeedRow = { id: string; name: string; unit: string; stock: number; out: string; in: string; inRate: string };

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
  /** only an Admin can change a figure that is already saved; everyone else sees it locked */
  isAdmin: boolean;
};

const num = (v: string | null | undefined) => {
  const n = v === null || v === undefined || v.trim() === "" ? 0 : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });

const boxBase = "min-w-0 rounded-md border px-1 py-2 text-center text-base tabular-nums";
const boxOpen = "border-neutral-300 bg-white";
const boxLocked = "border-neutral-200 bg-neutral-100 text-neutral-500 cursor-not-allowed";
// A total or stock figure the sheet works out itself: a box like the others, but never typed into.
const totalBox = "block min-w-0 w-full rounded-md border border-neutral-300 bg-neutral-50 px-1 py-2 text-center text-base font-semibold tabular-nums text-neutral-800 min-h-[42px]";
const th = "py-2 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500";

export default function DailySheetForm({ date, cows, customers, usage, feed, note, version, groupTotal, canFeed, isAdmin }: Props) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(saveDailySheet, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  // A saved figure is locked for everyone except an Admin (the server enforces the same rule).
  const locked = (saved: string) => !isAdmin && saved.trim() !== "";
  const boxCls = (saved: string, width: string) => `${boxBase} ${width} ${locked(saved) ? boxLocked : boxOpen}`;
  const lockTip = (saved: string) => (locked(saved) ? "Already saved. To change it, use Edit in the Milking, Milk Sale or Feed register." : undefined);

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

  // Puts figures read from a photo into the EMPTY, unlocked boxes as a draft (yellow). Saved boxes and anything already typed are
  // left alone, and nothing is saved until the person presses Save.
  const applyFills = (fills: Record<string, string>) => {
    const result = { applied: 0, locked: 0, typed: 0 };
    const form = formRef.current;
    if (!form) return result;
    for (const [name, value] of Object.entries(fills)) {
      const el = form.elements.namedItem(name);
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) continue;
      if (el.readOnly) {
        result.locked++;
        continue;
      }
      if (el.value.trim() !== "") {
        result.typed++;
        continue;
      }
      // a React-controlled box ignores a plain .value assignment, so go through the browser's own setter and tell the form
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.classList.add("ring-2", "ring-amber-400", "!bg-amber-50");
      result.applied++;
    }
    return result;
  };

  const gap = totals.production - totals.sold - totals.used;
  const lockedCount =
    cows.reduce((n, c) => n + [c.m, c.a, c.e].filter(locked).length, 0) +
    customers.filter((c) => locked(c.litres)).length +
    usage.filter((u) => locked(u.litres)).length +
    feed.reduce((n, f) => n + [f.out, f.in].filter(locked).length, 0);

  return (
    <form ref={formRef} action={formAction} onInput={recompute} className="flex flex-col gap-5">
      <input type="hidden" name="date" value={date} />
      {groupTotal > 0 && (
        <p className="text-sm bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-amber-900">
          A herd/group milk total of {fmt(groupTotal)} L is also recorded for this day. New cow entries cannot be added for a shift that a group total covers.
        </p>
      )}
      {lockedCount > 0 && (
        <p className="text-sm bg-neutral-50 border border-neutral-200 rounded-md px-3 py-2 text-neutral-700">
          Grey boxes are already saved for this day and are locked here. To change one, use its Edit button in the Milking, Milk Sale or Feed register. Empty boxes can still be filled in.
        </p>
      )}

      <PhotoFill
        date={date}
        ctx={{ cows: cows.map((c) => ({ id: c.id, tag: c.tag })), customers: customers.map((c) => ({ id: c.id, name: c.name })), feeds: feed.map((f) => ({ id: f.id, name: f.name })), canFeed }}
        onApply={applyFills}
      />

      <div key={version} className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <section className="bg-white border border-neutral-200 rounded-lg p-4 xl:row-span-4">
          <h2 className="font-semibold text-neutral-900 mb-3">1. Milk by cow (litres)</h2>
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-14" />
              <col />
              <col />
              <col />
              <col className="w-24" />
            </colgroup>
            <thead>
              <tr>
                <th className={`${th} text-left`}>Tag</th>
                <th className={th}>Morning</th>
                <th className={th}>Noon</th>
                <th className={th}>Evening</th>
                <th className={th}>Total</th>
              </tr>
            </thead>
            <tbody>
              {cows.map((c) => (
                <tr key={c.id} className="border-t border-neutral-100">
                  <td className="py-1.5 pr-2 text-left font-semibold text-neutral-900">{c.tag}</td>
                  {(["M", "A", "E"] as const).map((s) => {
                    const saved = c[s.toLowerCase() as "m" | "a" | "e"];
                    return (
                      <td key={s} className="px-1 py-1.5">
                        <input
                          name={`m_${c.id}_${s}`}
                          type="number"
                          step="0.01"
                          min="0"
                          max="200"
                          inputMode="decimal"
                          autoComplete="off"
                          defaultValue={saved}
                          readOnly={locked(saved)}
                          title={lockTip(saved)}
                          aria-label={`Tag ${c.tag} ${s === "M" ? "morning" : s === "A" ? "noon" : "evening"} litres`}
                          className={boxCls(saved, "w-full")}
                        />
                      </td>
                    );
                  })}
                  <td className="px-1 py-1.5">
                    <output className={totalBox} aria-label={`Tag ${c.tag} total litres`}>{totals.rows[c.id] ? fmt(totals.rows[c.id]) : ""}</output>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-neutral-300">
                <td colSpan={4} className="py-2.5 text-left font-semibold">
                  Production
                </td>
                <td className="px-1 py-2.5">
                  <output className={totalBox} aria-label="Production total litres">{fmt(totals.production)}</output>
                </td>
              </tr>
            </tfoot>
          </table>
          <p className="text-xs text-neutral-500 mt-2">Leave a box empty if nothing was recorded. Another animal? Use Milking Entry.</p>
        </section>

        <section className="bg-white border border-neutral-200 rounded-lg p-4">
          <h2 className="font-semibold text-neutral-900 mb-3">2. Milk sold (as written on the sheet)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
            {customers.map((c) => (
              <label key={c.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {c.name} <span className="text-neutral-400">(Rs {c.rate})</span>
                </span>
                <input
                  name={`sale_${c.id}`}
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  autoComplete="off"
                  defaultValue={c.litres}
                  readOnly={locked(c.litres)}
                  title={lockTip(c.litres)}
                  className={boxCls(c.litres, "w-24 shrink-0")}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="bg-white border border-neutral-200 rounded-lg p-4">
          <h2 className="font-semibold text-neutral-900 mb-3">3. Milk used on the farm</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
            {usage.map((u) => (
              <label key={u.type} className="flex items-center justify-between gap-3 text-sm">
                <span>{u.label}</span>
                <input
                  name={`use_${u.type}`}
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  autoComplete="off"
                  defaultValue={u.litres}
                  readOnly={locked(u.litres)}
                  title={lockTip(u.litres)}
                  className={boxCls(u.litres, "w-24 shrink-0")}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="bg-white border border-neutral-200 rounded-lg p-4">
          <h2 className="font-semibold text-neutral-900 mb-3">4. Feed</h2>
          {canFeed ? (
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[27%]" />
                <col />
                <col />
                <col />
                <col className="w-24" />
              </colgroup>
              <thead>
                <tr>
                  <th className={`${th} text-left`}>Feed</th>
                  <th className={th}>Used today</th>
                  <th className={th}>Received</th>
                  <th className={th} title="Rate paid per unit for the feed received. Needed for each purchase: feed is costed first-in, first-out.">Rate paid</th>
                  <th className={th}>Stock</th>
                </tr>
              </thead>
              <tbody>
                {feed.map((f) => (
                  <tr key={f.id} className="border-t border-neutral-100">
                    <td className="py-1.5 pr-2 text-left font-semibold text-neutral-900">
                      {f.name} <span className="text-neutral-400 font-normal">({f.unit})</span>
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        name={`out_${f.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        autoComplete="off"
                        defaultValue={f.out}
                        readOnly={locked(f.out)}
                        title={lockTip(f.out)}
                        aria-label={`${f.name} used today`}
                        className={boxCls(f.out, "w-full")}
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        name={`in_${f.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        autoComplete="off"
                        defaultValue={f.in}
                        readOnly={locked(f.in)}
                        title={lockTip(f.in)}
                        aria-label={`${f.name} received today`}
                        className={boxCls(f.in, "w-full")}
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        name={`inrate_${f.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        autoComplete="off"
                        defaultValue={f.inRate}
                        readOnly={locked(f.in)}
                        title={locked(f.in) ? "Already saved. Change the rate with Edit on Feed & Inventory." : `Rate paid per ${f.unit}, needed when something is received`}
                        aria-label={`${f.name} rate paid per ${f.unit}`}
                        placeholder="Rs"
                        className={boxCls(f.in, "w-full")}
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <output className={`${totalBox} ${f.stock < 0 ? "!text-red-600" : ""}`} aria-label={`${f.name} stock`}>{fmt(f.stock)}</output>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-neutral-500">Your account cannot record feed.</p>
          )}
        </section>

        <section className="bg-white border border-neutral-200 rounded-lg p-4">
          <h2 className="font-semibold text-neutral-900 mb-3">5. Notes for the day</h2>
          <textarea
            name="note"
            rows={3}
            maxLength={1000}
            defaultValue={note}
            readOnly={!isAdmin && note.trim() !== ""}
            placeholder="e.g. AI of Tag 55 (Florus), silage delivery 980 maund, animal sold"
            className={`w-full rounded-md border px-3 py-2 text-base ${!isAdmin && note.trim() !== "" ? boxLocked : boxOpen}`}
          />
          <p className="text-xs text-neutral-500 mt-1">Breeding, health and animal sales are still recorded in their own forms; this note is the memo for the day.</p>
        </section>
      </div>

      <div className="sticky bottom-0 -mx-1 bg-white/95 backdrop-blur border border-neutral-200 rounded-lg p-3 flex flex-col gap-2 shadow-md">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-5 gap-y-1 text-sm">
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
