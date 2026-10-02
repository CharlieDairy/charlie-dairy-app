"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import DataTable, { type DataTableColumn } from "@/components/DataTable";
import { formatRs } from "@/lib/format";
import { deleteAssetInline, deleteAssets, type BulkDeleteState } from "./actions";
import type { Asset } from "@prisma/client";

function DeleteRowButton({ id, details }: { id: string; details: string }) {
  const [state, formAction, isPending] = useActionState<BulkDeleteState, FormData>(deleteAssetInline, undefined);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        e.stopPropagation();
        if (!confirm(`Delete asset "${details}"? This can't be undone.`)) e.preventDefault();
      }}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1"
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={isPending} className="text-xs rounded px-2 py-1 border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50">
        {isPending ? "…" : "Delete"}
      </button>
      {state && !state.success && <span className="text-xs text-red-600">{state.message}</span>}
    </form>
  );
}

export default function AssetsTable({ assets, isAdmin = false }: { assets: Asset[]; isAdmin?: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, formAction, isPending] = useActionState<BulkDeleteState, FormData>(deleteAssets, undefined);
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

  const columns: DataTableColumn<Asset>[] = [
    {
      key: "photo",
      header: "Photo",
      render: (a) =>
        a.photoUrl ? (
          <Image src={a.photoUrl} alt={a.details} width={40} height={40} className="rounded object-cover border border-neutral-200" />
        ) : (
          <div className="w-10 h-10 rounded bg-neutral-100 border border-neutral-200" />
        ),
    },
    { key: "class", header: "Class", sortValue: (a) => a.assetClass, render: (a) => a.assetClass },
    { key: "details", header: "Details", sortValue: (a) => a.details, render: (a) => a.details },
    { key: "qty", header: "Qty", align: "right", sortValue: (a) => a.qty, render: (a) => a.qty },
    { key: "value", header: "Current Value", align: "right", sortValue: (a) => a.currentValue, render: (a) => formatRs(a.currentValue) },
    {
      key: "actions",
      header: "Actions",
      render: (a) => (
        <div className="flex items-center gap-2">
          <Link href={`/admin/assets/${a.id}`} className="text-xs rounded px-2 py-1 border border-neutral-300 text-neutral-700 hover:bg-neutral-100">
            Edit
          </Link>
          <DeleteRowButton id={a.id} details={a.details} />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {isAdmin && (
        <form
          ref={formRef}
          action={formAction}
          onSubmit={(e) => {
            if (!confirm(`Delete ${selected.size} selected asset${selected.size === 1 ? "" : "s"}? This can't be undone.`)) e.preventDefault();
          }}
          className="flex items-center gap-3 flex-wrap"
        >
          {Array.from(selected).map((id) => (
            <input key={id} type="hidden" name="assetIds" value={id} />
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
        data={assets}
        columns={columns}
        rowKey={(a) => a.id}
        searchPlaceholder="Search by class or details…"
        pageSize={50}
        emptyMessage="No assets recorded yet."
        selectable={isAdmin}
        selectedKeys={selected}
        onToggleSelect={toggleSelect}
      />
    </div>
  );
}
