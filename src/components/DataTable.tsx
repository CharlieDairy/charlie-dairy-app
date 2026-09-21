"use client";

import { useMemo, useState, type ReactNode } from "react";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Value to sort/search by. Omit for columns that shouldn't be sortable. */
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
};

export default function DataTable<T>({
  data,
  columns,
  rowKey,
  searchable = true,
  searchPlaceholder = "Search…",
  searchFn,
  pageSize = 25,
  onRowClick,
  emptyMessage = "No records found.",
}: {
  data: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Defaults to matching the query against every column's rendered/sort text. */
  searchFn?: (row: T, query: string) => boolean;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const defaultSearch = (row: T, q: string) => {
    const lower = q.toLowerCase();
    return columns.some((c) => {
      const v = c.sortValue ? c.sortValue(row) : null;
      return v !== null && String(v).toLowerCase().includes(lower);
    });
  };

  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    const matcher = searchFn ?? defaultSearch;
    return data.filter((row) => matcher(row, query.trim()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, query, searchFn]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const withValues = filtered.map((row) => ({ row, v: col.sortValue!(row) }));
    withValues.sort((a, b) => {
      if (a.v < b.v) return sortDir === "asc" ? -1 : 1;
      if (a.v > b.v) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return withValues.map((w) => w.row);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-3">
      {searchable && (
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder={searchPlaceholder}
          className="border border-border rounded-md px-3 py-2 text-sm w-full sm:w-64"
        />
      )}
      <div className="overflow-x-auto bg-surface border border-border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100 sticky top-0">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-3 py-2 font-medium text-text-muted ${c.align === "right" ? "text-right" : "text-left"} ${
                    c.sortValue ? "cursor-pointer select-none hover:text-text" : ""
                  }`}
                  onClick={() => c.sortValue && toggleSort(c.key)}
                >
                  {c.header}
                  {sortKey === c.key && (sortDir === "asc" ? " ▲" : " ▼")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr
                key={rowKey(row)}
                className={`border-t border-border ${onRowClick ? "cursor-pointer hover:bg-neutral-50" : ""}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2 ${c.align === "right" ? "text-right" : "text-left"}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-text-muted">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-text-muted">
          <span>
            Page {currentPage} of {totalPages} ({sorted.length} rows)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="underline disabled:no-underline disabled:opacity-40"
            >
              ← Previous
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="underline disabled:no-underline disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
