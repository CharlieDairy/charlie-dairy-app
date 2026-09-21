"use client";

import Link from "next/link";
import DataTable, { type DataTableColumn } from "@/components/DataTable";
import StatusSelect from "./StatusSelect";
import DeleteCowButton from "./DeleteCowButton";

export type CowRow = {
  id: string;
  tag: string;
  gender: string;
  status: string;
  dateOfBirth: string | null; // ISO date, serialized from the server component
  lactationNumber: number;
};

function ageFromDob(dobIso: string | null): string {
  if (!dobIso) return "—";
  const ms = Date.now() - new Date(dobIso).getTime();
  const years = ms / (365.25 * 86_400_000);
  if (years < 1) return `${Math.floor(years * 12)} mo`;
  return `${years.toFixed(1)} yr`;
}

export default function CowsTable({
  cows,
  statusOptions,
}: {
  cows: CowRow[];
  statusOptions: { code: string; label: string }[];
}) {
  const columns: DataTableColumn<CowRow>[] = [
    {
      key: "tag",
      header: "Tag",
      sortValue: (c) => Number(c.tag) || c.tag,
      render: (c) => (
        <Link href={`/admin/cows/${c.id}`} className="text-primary hover:underline font-medium">
          {c.tag}
        </Link>
      ),
    },
    { key: "gender", header: "Gender", sortValue: (c) => c.gender, render: (c) => c.gender },
    {
      key: "status",
      header: "Status",
      sortValue: (c) => c.status,
      render: (c) => <StatusSelect cowId={c.id} status={c.status} options={statusOptions} />,
    },
    {
      key: "dob",
      header: "Date of Birth",
      sortValue: (c) => c.dateOfBirth ?? "",
      render: (c) => (c.dateOfBirth ? c.dateOfBirth.slice(0, 10) : "—"),
    },
    { key: "age", header: "Age", render: (c) => ageFromDob(c.dateOfBirth) },
    {
      key: "lactation",
      header: "Lactation #",
      align: "right",
      sortValue: (c) => c.lactationNumber,
      render: (c) => c.lactationNumber,
    },
    {
      key: "actions",
      header: "Actions",
      render: (c) => (
        <div className="flex items-start gap-2">
          <Link href={`/admin/cows/${c.id}`} className="text-xs rounded px-2 py-1 border border-border text-text hover:bg-neutral-100">
            View
          </Link>
          <DeleteCowButton cowId={c.id} tag={c.tag} />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={cows}
      columns={columns}
      rowKey={(c) => c.id}
      searchPlaceholder="Search by tag…"
      pageSize={50}
    />
  );
}
