"use client";

import { useMemo, useState } from "react";
import AnimalCard, { type AnimalRow } from "./AnimalCard";
import type { AnimalCategory } from "@/lib/reports/herdOverview";

export default function AnimalListClient({
  animals,
  categories,
  statusOptions,
}: {
  animals: AnimalRow[];
  categories: AnimalCategory[];
  statusOptions: { code: string; label: string }[];
}) {
  const [category, setCategory] = useState("ALL");
  const [dueSoon, setDueSoon] = useState(false);
  const [noWeight, setNoWeight] = useState(false);
  const [search, setSearch] = useState("");

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((a) => (
          <AnimalCard key={a.id} animal={a} statusOptions={statusOptions} />
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-neutral-400 col-span-full text-center py-8">No animals match this filter.</p>
        )}
      </div>
    </div>
  );
}
