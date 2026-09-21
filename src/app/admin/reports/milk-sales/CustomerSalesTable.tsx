"use client";

import { useRouter } from "next/navigation";
import DataTable, { type DataTableColumn } from "@/components/DataTable";
import Badge from "@/components/Badge";
import { formatRs } from "@/lib/format";
import type { CustomerSalesSummary } from "@/lib/reports/milkSalesByCustomer";

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "—";
}

export default function CustomerSalesTable({ rows }: { rows: CustomerSalesSummary[] }) {
  const router = useRouter();

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
    <DataTable
      data={rows}
      columns={columns}
      rowKey={(r) => r.buyer}
      searchPlaceholder="Search by customer…"
      onRowClick={(r) => router.push(`/admin/reports/milk-sales?buyer=${encodeURIComponent(r.buyer)}`)}
      emptyMessage="No milk sales recorded yet."
    />
  );
}
