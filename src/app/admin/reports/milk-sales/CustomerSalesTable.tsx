"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import DataTable, { type DataTableColumn } from "@/components/DataTable";
import Badge from "@/components/Badge";
import { formatRs } from "@/lib/format";
import type { CustomerSalesSummary } from "@/lib/reports/milkSalesByCustomer";
import { deleteCustomerSales, type BulkDeleteState } from "./actions";

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "—";
}

export default function CustomerSalesTable({ rows, isAdmin = false }: { rows: CustomerSalesSummary[]; isAdmin?: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, formAction, isPending] = useActionState<BulkDeleteState, FormData>(deleteCustomerSales, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) setSelected(new Set());
  }, [state]);

  const toggleSelect = (buyer: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(buyer)) next.delete(buyer); else next.add(buyer);
      return next;
    });
  };

  const columns: DataTableColumn<CustomerSalesSummary>[] = [
    { key: "buyer", header: "Customer", sortValue: (r) => r.buyer, render: (r) => <span className="font-medium">{r.buyer}</span> },
    { key: "litres", header: "Total Litres", align: "right", sortValue: (r) => r.totalLitres, render: (r) => r.totalLitres.toLocaleString() },
    {
      key: "rate",
      header: "Avg Rate",
      align: "right",
      sortValue: (r) => r.avgRate ?? 0,
      render: (r) => (r.avgRate !== null ? `Rs ${r.avgRate.toFixed(2)}/L` : "—"),
    },
    { key: "sales", header: "Total Sales", align: "right", sortValue: (r) => r.totalSaleAmount, render: (r) => formatRs(r.totalSaleAmount) },
    { key: "paid", header: "Total Paid", align: "right", sortValue: (r) => r.totalPaid, render: (r) => formatRs(r.totalPaid) },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "right",
      sortValue: (r) => r.outstandingBalance,
      render: (r) =>
        r.outstandingBalance > 0 ? (
          <Badge tone="warning">{formatRs(r.outstandingBalance)}</Badge>
        ) : r.outstandingBalance < 0 ? (
          <Badge tone="info">{formatRs(Math.abs(r.outstandingBalance))} credit</Badge>
        ) : (
          <Badge tone="success">Settled</Badge>
        ),
    },
    { key: "lastSale", header: "Last Sale", sortValue: (r) => (r.lastSaleDate ? r.lastSaleDate.toISOString() : ""), render: (r) => fmtDate(r.lastSaleDate) },
  ];

  return (
    <div className="flex flex-col gap-3">
      {isAdmin && (
        <form
          ref={formRef}
          action={formAction}
          onSubmit={(e) => {
            if (!confirm(`Delete all sales and payments for ${selected.size} selected customer${selected.size === 1 ? "" : "s"}? This can't be undone.`)) e.preventDefault();
          }}
          className="flex items-center gap-3"
        >
          {Array.from(selected).map((buyer) => (
            <input key={buyer} type="hidden" name="buyers" value={buyer} />
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
        rowKey={(r) => r.buyer}
        searchPlaceholder="Search by customer…"
        onRowClick={(r) => router.push(`/admin/reports/milk-sales?buyer=${encodeURIComponent(r.buyer)}`)}
        emptyMessage="No milk sales recorded yet."
        selectable={isAdmin}
        selectedKeys={selected}
        onToggleSelect={toggleSelect}
      />
    </div>
  );
}
