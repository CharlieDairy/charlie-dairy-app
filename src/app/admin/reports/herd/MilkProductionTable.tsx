"use client";

import Link from "next/link";
import DataTable, { type DataTableColumn } from "@/components/DataTable";
import type { HerdRow } from "@/lib/reports/herd";

export default function MilkProductionTable({ rows }: { rows: HerdRow[] }) {
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
  ];

  return (
    <DataTable
      data={rows}
      columns={columns}
      rowKey={(r) => r.cowId}
      searchPlaceholder="Search by tag or status…"
      pageSize={50}
    />
  );
}
