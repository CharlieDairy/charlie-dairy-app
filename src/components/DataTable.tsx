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
  selectable = false,
  selectedKeys,
  onToggleSelect,
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
  /** Adds a checkbox column plus a select-all-on-page checkbox in the header. */
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onToggleSelect?: (key: string) => void;
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
          className="border border-border rounded-md px-3 py-2 text-sm w-full md:w-64"
        />
      )}
      {/* Phones: one card per row (first column is the title, the rest are
          label / value lines) -- far easier than side-scrolling a wide table. */}
      <div className="flex flex-col gap-2 md:hidden">
        {pageRows.map((row) => {
          const key = rowKey(row);
          const [first, ...rest] = columns;
          return (
            <div
              key={key}
              onClick={() => onRowClick?.(row)}
              className={`rounded-lg border border-border bg-surface p-3 ${onRowClick ? "active:bg-neutral-50" : ""}`}
            >
              <div className="flex items-start gap-3">
                {selectable && (
                  <input
                    type="checkbox"
                    aria-label={`Select row ${key}`}
                    checked={selectedKeys?.has(key) ?? false}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => onToggleSelect?.(key)}
                    className="mt-1"
                  />
                )}
                <div className="min-w-0 flex-1 font-semibold text-text">{first.render(row)}</div>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                {rest.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wide text-text-muted">{c.header}</dt>
                    <dd className="break-words text-text">{c.render(row)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
        {pageRows.length === 0 && (
          <p className="rounded-lg border border-border bg-surface px-3 py-6 text-center text-sm text-text-muted">{emptyMessage}</p>
        )}
      </div>
      <div className="hidden md:block overflow-x-auto bg-surface border border-border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100 sticky top-0">
            <tr>
              {selectable && (
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all on this page"
                    checked={pageRows.length > 0 && pageRows.every((r) => selectedKeys?.has(rowKey(r)))}
                    onChange={() => {
                      const allSelected = pageRows.every((r) => selectedKeys?.has(rowKey(r)));
                      for (const r of pageRows) {
                        const key = rowKey(r);
                        const isSelected = selectedKeys?.has(key) ?? false;
                        if (allSelected === isSelected) onToggleSelect?.(key);
                      }
                    }}
                  />
                </th>
              )}
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
            {pageRows.map((row) => {
              const key = rowKey(row);
              return (
                <tr
                  key={key}
                  className={`border-t border-border ${onRowClick ? "cursor-pointer hover:bg-neutral-50" : ""}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select row ${key}`}
                        checked={selectedKeys?.has(key) ?? false}
                        onChange={() => onToggleSelect?.(key)}
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={`px-3 py-2 ${c.align === "right" ? "text-right" : "text-left"}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-3 py-6 text-center text-text-muted">
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
