"use client";

import Link from "next/link";
import DataTable, { type DataTableColumn } from "@/components/DataTable";
import Badge from "@/components/Badge";
import DeleteRowButton from "@/components/DeleteRowButton";
import { formatRs } from "@/lib/format";
import { toggleCustomerActive, deleteCustomer } from "./actions";
import type { CustomerWithSales } from "@/lib/reports/milkSalesByCustomer";

function Ic({ children }: { children: React.ReactNode }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const IconEye = <Ic><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></Ic>;
const IconEdit = <Ic><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z" /></Ic>;
const IconBan = <Ic><circle cx="12" cy="12" r="10" /><line x1="4.9" y1="4.9" x2="19.1" y2="19.1" /></Ic>;
const IconTrash = <Ic><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></Ic>;

function avatarColor(name: string): string {
  const colors = ["bg-teal-600", "bg-sky-600", "bg-amber-600", "bg-violet-600", "bg-rose-600", "bg-emerald-600"];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) % colors.length;
  return colors[hash];
}

export default function CustomersTable({ rows, isAdmin = false }: { rows: CustomerWithSales[]; isAdmin?: boolean }) {
  const columns: DataTableColumn<CustomerWithSales>[] = [
    {
      key: "name",
      header: "Customer",
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-white text-xs font-semibold ${avatarColor(r.name)}`}>
            {r.name.charAt(0).toUpperCase()}
          </span>
          <span className="font-medium">{r.name}</span>
        </div>
      ),
    },
    { key: "litres", header: "Sales (L)", align: "right", sortValue: (r) => r.totalLitres, render: (r) => `${r.totalLitres.toLocaleString()} L` },
    { key: "revenue", header: "Revenue", align: "right", sortValue: (r) => r.totalSaleAmount, render: (r) => formatRs(r.totalSaleAmount) },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      sortValue: (r) => r.outstandingBalance,
      render: (r) => (
        <span className={r.outstandingBalance > 0 ? "text-danger font-medium" : "text-text-muted"}>{formatRs(r.outstandingBalance)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => (r.active ? 1 : 0),
      render: (r) => <Badge tone={r.active ? "success" : "neutral"}>{r.active ? "Active" : "Hidden"}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/admin/reports/milk-sales?buyer=${encodeURIComponent(r.name)}`} title="View sales" className="p-1.5 rounded border border-neutral-200 text-neutral-500 hover:bg-neutral-100">
            {IconEye}
          </Link>
          <Link href={`/admin/customers/${r.id}`} title={isAdmin ? "Edit" : "View"} className="p-1.5 rounded border border-neutral-200 text-neutral-500 hover:bg-neutral-100">
            {IconEdit}
          </Link>
          {isAdmin && (
            <>
              <form action={toggleCustomerActive}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="active" value={(!r.active).toString()} />
                <button type="submit" title={r.active ? "Deactivate" : "Activate"} className="p-1.5 rounded border border-neutral-200 text-neutral-500 hover:bg-neutral-100">
                  {IconBan}
                </button>
              </form>
              <DeleteRowButton
                action={deleteCustomer}
                hiddenFields={{ id: r.id }}
                confirmMessage={`Delete customer "${r.name}"? This can't be undone.`}
                icon={IconTrash}
              />
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={rows}
      columns={columns}
      rowKey={(r) => r.id}
      searchPlaceholder="Search customers…"
      emptyMessage="No customers match this filter."
    />
  );
}
