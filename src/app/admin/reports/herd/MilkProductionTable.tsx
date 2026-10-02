"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import DataTable, { type DataTableColumn } from "@/components/DataTable";
import type { HerdRow, PeriodKey } from "@/lib/reports/herd";
import { PERIOD_OPTIONS } from "@/lib/periodOptions";
import { deleteMilkProductionForCows, type BulkDeleteState } from "./actions";

const PERIOD_LABELS: Record<PeriodKey, string> = Object.fromEntries(PERIOD_OPTIONS.map((p) => [p.key, p.label])) as Record<PeriodKey, string>;
PERIOD_LABELS.custom = "the custom range";

export default function MilkProductionTable({ rows, isAdmin = false, period, from, to }: { rows: HerdRow[]; isAdmin?: boolean; period: PeriodKey; from?: string; to?: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [state, formAction, isPending] = useActionState<BulkDeleteState, FormData>(deleteMilkProductionForCows, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) setSelected(new Set());
  }, [state]);

  const statuses = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const filteredRows = useMemo(
    () => (statusFilter === "ALL" ? rows : rows.filter((r) => r.status === statusFilter)),
    [rows, statusFilter]
  );

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
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setStatusFilter("ALL")}
          className={`text-xs rounded-full px-3 py-1.5 border ${
            statusFilter === "ALL" ? "bg-primary text-white border-primary" : "border-border text-text-muted hover:bg-neutral-100"
          }`}
        >
          All {rows.length}
        </button>
        {statuses.map(([status, count]) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`text-xs rounded-full px-3 py-1.5 border ${
              statusFilter === status ? "bg-primary text-white border-primary" : "border-border text-text-muted hover:bg-neutral-100"
            }`}
          >
            {status} {count}
          </button>
        ))}
      </div>
      {isAdmin && (
        <form
          ref={formRef}
          action={formAction}
          onSubmit={(e) => {
            if (!confirm(`Delete milking records within ${PERIOD_LABELS[period]} for ${selected.size} selected animal${selected.size === 1 ? "" : "s"}? This can't be undone.`)) e.preventDefault();
          }}
          className="flex items-center gap-3"
        >
          <input type="hidden" name="period" value={period} />
          {from && <input type="hidden" name="from" value={from} />}
          {to && <input type="hidden" name="to" value={to} />}
          {Array.from(selected).map((id) => (
            <input key={id} type="hidden" name="cowIds" value={id} />
          ))}
          <button
            type="submit"
            disabled={selected.size === 0 || isPending}
            className="text-xs rounded px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? "Deleting…" : `Delete selected (${selected.size}) — ${PERIOD_LABELS[period]}`}
          </button>
          {state && <p className={`text-xs ${state.success ? "text-green-700" : "text-red-600"}`}>{state.message}</p>}
        </form>
      )}
      <DataTable
        data={filteredRows}
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
