"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import DataTable, { type DataTableColumn } from "@/components/DataTable";
import type { HerdRow } from "@/lib/reports/herd";
import { deleteMilkProductionForCows, type BulkDeleteState } from "./actions";

export default function MilkProductionTable({ rows, isAdmin = false }: { rows: HerdRow[]; isAdmin?: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, formAction, isPending] = useActionState<BulkDeleteState, FormData>(deleteMilkProductionForCows, undefined);
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

  const columns: DataTableColumn<HerdRow>[] = [
    {
      key: "tag",
      header: "Tag",
      sortValue: (r) => Number(r.tag) || r.tag,
      render: (r) => (
        <Link href={`/admin/cows/${r.cowId}`} className="text-primary hover:underline font-medium">
          {r.tag}
        </Link>
      ),
    },
    { key: "status", header: "Status", sortValue: (r) => r.status, render: (r) => r.status },
    { key: "days", header: "Days Milked", align: "right", sortValue: (r) => r.daysMilked, render: (r) => r.daysMilked },
    { key: "total", header: "Total Litres", align: "right", sortValue: (r) => r.totalLitres, render: (r) => r.totalLitres.toFixed(1) },
    { key: "avg", header: "Avg L / Day", align: "right", sortValue: (r) => r.avgLitresPerDay, render: (r) => r.avgLitresPerDay.toFixed(1) },
    { key: "fat", header: "Avg Fat %", align: "right", sortValue: (r) => r.avgFatPct ?? -1, render: (r) => (r.avgFatPct != null ? `${r.avgFatPct.toFixed(1)}%` : "—") },
    { key: "snf", header: "Avg SNF %", align: "right", sortValue: (r) => r.avgSnfPct ?? -1, render: (r) => (r.avgSnfPct != null ? `${r.avgSnfPct.toFixed(1)}%` : "—") },
  ];

  return (
    <div className="flex flex-col gap-3">
      {isAdmin && (
        <form
          ref={formRef}
          action={formAction}
          onSubmit={(e) => {
            if (!confirm(`Delete all milking records for ${selected.size} selected animal${selected.size === 1 ? "" : "s"}? This can't be undone.`)) e.preventDefault();
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
      <DataTable
        data={rows}
        columns={columns}
        rowKey={(r) => r.cowId}
        searchPlaceholder="Search by tag or status…"
        pageSize={50}
        selectable={isAdmin}
        selectedKeys={selected}
        onToggleSelect={toggleSelect}
      />
    </div>
  );
}
