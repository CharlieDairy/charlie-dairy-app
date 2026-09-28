"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import AnimalCard, { type AnimalRow } from "./AnimalCard";
import type { AnimalCategory } from "@/lib/reports/herdOverview";
import { deleteCows, type BulkDeleteState } from "./actions";

export default function AnimalListClient({
  animals,
  categories,
  statusOptions,
  isAdmin = false,
}: {
  animals: AnimalRow[];
  categories: AnimalCategory[];
  statusOptions: { code: string; label: string }[];
  isAdmin?: boolean;
}) {
  const [category, setCategory] = useState("ALL");
  const [dueSoon, setDueSoon] = useState(false);
  const [noWeight, setNoWeight] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, formAction, isPending] = useActionState<BulkDeleteState, FormData>(deleteCows, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) setSelected(new Set());
  }, [state]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    return animals
      .filter((a) => category === "ALL" || a.status === category)
      .filter((a) => !dueSoon || a.pregnant)
      .filter((a) => !noWeight || a.latestWeightKg === null)
      .filter((a) => !search || a.tag.toLowerCase().includes(search.toLowerCase()));
  }, [animals, category, dueSoon, noWeight, search]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by tag…"
          className="border border-neutral-300 rounded-md px-3 py-1.5 text-sm w-40"
        />
        <button
          onClick={() => setDueSoon((v) => !v)}
          className={`text-xs rounded-full px-3 py-1.5 border ${dueSoon ? "bg-primary text-white border-primary" : "border-border text-text-muted hover:bg-neutral-100"}`}
        >
          Pregnant
        </button>
        <button
          onClick={() => setNoWeight((v) => !v)}
          className={`text-xs rounded-full px-3 py-1.5 border ${noWeight ? "bg-primary text-white border-primary" : "border-border text-text-muted hover:bg-neutral-100"}`}
        >
          No Weight Recorded
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap border-b border-neutral-200 pb-2">
        {categories.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`text-xs rounded-full px-3 py-1.5 border ${
              category === c.key ? "bg-primary text-white border-primary" : "border-border text-text-muted hover:bg-neutral-100"
            }`}
          >
            {c.label} {c.count}
          </button>
        ))}
      </div>

      {isAdmin && (
        <form
          ref={formRef}
          action={formAction}
          onSubmit={(e) => {
            if (!confirm(`Delete ${selected.size} selected animal${selected.size === 1 ? "" : "s"}? This can't be undone.`)) e.preventDefault();
          }}
          className="flex items-center gap-3"
        >
          {Array.from(selected).map((id) => (
            <input key={id} type="hidden" name="cowIds" value={id} />
          ))}
          <button
            type="submit"
            disabled={selected.size === 0 || isPending}
            className="text-xs rounded px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? "Deleting…" : `Delete selected (${selected.size})`}
          </button>
          {state && <p className={`text-xs ${state.success ? "text-green-700" : "text-red-600"}`}>{state.message}</p>}
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((a) => (
          <AnimalCard
            key={a.id}
            animal={a}
            statusOptions={statusOptions}
            selectable={isAdmin}
            selected={selected.has(a.id)}
            onToggleSelect={toggleSelect}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-neutral-400 col-span-full text-center py-8">No animals match this filter.</p>
        )}
      </div>
    </div>
  );
}
