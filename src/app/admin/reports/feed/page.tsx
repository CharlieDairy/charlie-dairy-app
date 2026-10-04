import Link from "next/link";
import { getFeedPeriodReport } from "@/lib/reports/feed";
import { periodRange } from "@/lib/reports/herd";
import { resolvePeriod } from "@/lib/period";
import { getLiveUser, canWrite } from "@/lib/access";
import { formatRs } from "@/lib/format";
import StatCard from "@/components/StatCard";
import Badge from "@/components/Badge";
import PeriodBar from "@/components/PeriodBar";
import FeedLedgerTable from "./FeedLedgerTable";

const qty = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
const rs2 = (n: number) => `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;

function stockTone(closing: number, daysLeft: number | null): { tone: "danger" | "warning" | "success" | "neutral"; label: string } {
  // A negative balance means more was logged consumed than ever logged
  // received -- a data gap, not a real "days left" countdown.
  if (closing < 0) return { tone: "danger", label: "Deficit" };
  if (closing === 0) return { tone: "warning", label: "Empty" };
  if (daysLeft === null) return { tone: "neutral", label: "No recent use" };
  if (daysLeft < 7) return { tone: "danger", label: `${Math.round(daysLeft)}d left` };
  if (daysLeft < 14) return { tone: "warning", label: `${Math.round(daysLeft)}d left` };
  return { tone: "success", label: `${Math.round(daysLeft)}d left` };
}

export default async function FeedOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string; period?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { period, from, to } = await resolvePeriod(params, "month");
  const range = periodRange(period, new Date(), from, to);
  const user = await getLiveUser();
  const canEdit = canWrite(user);
  const isAdmin = user?.role === "ADMIN"; // edit / delete / delete-all are Admin-only

  const report = await getFeedPeriodReport(range, params.feed);
  const rows = report.rows;
  const selectedRow = params.feed ? rows.find((r) => r.feedType === params.feed) : undefined;
  const unitLabel = selectedRow?.unit ?? "";

  const feedHref = (feed: string) => {
    const qs = new URLSearchParams({ period });
    if (period === "custom" && from && to) {
      qs.set("from", from);
      qs.set("to", to);
    }
    if (feed) qs.set("feed", feed);
    return `?${qs.toString()}`;
  };

  const units = new Set(rows.map((r) => r.unit ?? ""));
  const sameUnit = units.size <= 1;
  const total = (pick: (r: (typeof rows)[number]) => number) => rows.reduce((n, r) => n + pick(r), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Feed &amp; Inventory</h1>
        <div className="flex items-center gap-2">
          {canEdit && <Link href="/entry/feed" className="link-btn link-btn-primary">+ Feed entry →</Link>}
          <Link href="/admin/feed/items" className="link-btn">Feed Master</Link>
        </div>
      </div>
      <p className="text-base font-semibold text-neutral-600">
        Pick a feed to see every entry with a running balance, or leave it on All to compare feeds. Opening is what was
        in stock before the period starts; Closing = Opening + In − Out.
      </p>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white p-3">
        <span className="text-xs font-semibold text-text-muted">FEED</span>
        {[{ key: "", label: "All feeds" }, ...rows.map((r) => ({ key: r.feedType, label: r.feedType }))].map((f) => {
          const active = (selectedRow?.feedType ?? "") === f.key;
          return (
            <Link
              key={f.key || "all"}
              href={feedHref(f.key)}
              className={`rounded-full border px-3 py-2 text-xs ${
                active ? "bg-primary text-white border-primary" : "border-border text-text-muted hover:bg-primary-light"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <PeriodBar period={period} from={from} to={to} extraParams={selectedRow ? { feed: selectedRow.feedType } : undefined} />

      {selectedRow ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Opening balance" value={`${qty(selectedRow.opening)} ${unitLabel}`} />
            <StatCard label="In (received)" value={`${qty(selectedRow.inQty)} ${unitLabel}`} tone="positive" />
            <StatCard label="Out (issued)" value={`${qty(selectedRow.outQty)} ${unitLabel}`} />
            <StatCard label="Closing balance" value={`${qty(selectedRow.closing)} ${unitLabel}`} tone={selectedRow.closing < 0 ? "negative" : undefined} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label={`Avg daily use (${report.days} day${report.days === 1 ? "" : "s"})`} value={`${selectedRow.avgDailyUse.toFixed(1)} ${unitLabel}`} />
            <StatCard label="Avg rate" value={selectedRow.avgRate !== null ? `${rs2(selectedRow.avgRate)} / ${unitLabel || "unit"}` : "Not recorded"} />
            <StatCard label="Cost of feed used" value={selectedRow.outCost > 0 ? formatRs(selectedRow.outCost) : "Not recorded"} />
            <StatCard
              label="Stock status"
              value={selectedRow.lowStock ? "Low stock" : stockTone(selectedRow.closing, selectedRow.daysLeft).label}
              tone={selectedRow.lowStock || selectedRow.closing < 0 ? "negative" : undefined}
            />
          </div>

          <FeedLedgerTable
            lines={report.ledger ?? []}
            feedType={selectedRow.feedType}
            feedNames={rows.filter((r) => r.inMaster).map((r) => r.feedType)}
            unit={unitLabel}
            opening={selectedRow.opening}
            inQty={selectedRow.inQty}
            outQty={selectedRow.outQty}
            closing={selectedRow.closing}
            from={range.start.toISOString().slice(0, 10)}
            to={new Date(range.end.getTime() - 86_400_000).toISOString().slice(0, 10)}
            isAdmin={isAdmin}
          />          {selectedRow.closing < 0 && (
            <p className="text-xs text-danger">
              A negative balance means more was logged as issued (Out) than was ever recorded as received (In) — check
              for a missing purchase entry.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total closing stock" value={sameUnit ? `${qty(total((r) => r.closing))} ${[...units][0] ?? ""}` : "Mixed units"} />
            <StatCard label="Low stock feeds" value={String(rows.filter((r) => r.lowStock).length)} tone={rows.some((r) => r.lowStock) ? "negative" : "positive"} />
            <StatCard label="Consumed in period" value={sameUnit ? `${qty(total((r) => r.outQty))} ${[...units][0] ?? ""}` : "Mixed units"} />
            <StatCard label="Feed cost in period" value={formatRs(total((r) => r.outCost))} />
          </div>

          <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="text-left px-3 py-2">Feed</th>
                  <th className="text-right px-3 py-2">Opening</th>
                  <th className="text-right px-3 py-2">In</th>
                  <th className="text-right px-3 py-2">Out</th>
                  <th className="text-right px-3 py-2">Closing</th>
                  <th className="text-right px-3 py-2">Avg daily use</th>
                  <th className="text-right px-3 py-2">Avg rate</th>
                  <th className="text-right px-3 py-2">Cost used</th>
                  <th className="text-left px-3 py-2">Stock status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const status = stockTone(r.closing, r.daysLeft);
                  return (
                    <tr key={r.feedType} className="border-t border-neutral-100">
                      <td className="px-3 py-2 font-medium">
                        <Link href={feedHref(r.feedType)} className="text-primary hover:underline">{r.feedType}</Link>
                        {r.unit && <span className="ml-1 text-xs text-neutral-400">{r.unit}</span>}
                        {!r.inMaster && <span className="ml-1 text-xs text-warning" title="Not in Feed Master">(not in master)</span>}
                      </td>
                      <td className="px-3 py-2 text-right">{qty(r.opening)}</td>
                      <td className="px-3 py-2 text-right text-green-700">{qty(r.inQty)}</td>
                      <td className="px-3 py-2 text-right">{qty(r.outQty)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${r.closing < 0 ? "text-danger" : ""}`}>{qty(r.closing)}</td>
                      <td className="px-3 py-2 text-right">{r.avgDailyUse.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right">{r.avgRate !== null ? rs2(r.avgRate) : "—"}</td>
                      <td className="px-3 py-2 text-right">{r.outCost > 0 ? formatRs(r.outCost) : "—"}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge tone={status.tone}>{status.label}</Badge>
                          {r.lowStock && <Badge tone="danger">Low Stock</Badge>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-neutral-500">
                      No feeds yet. Add them in Feed Master, then record entries.
                    </td>
                  </tr>
                )}
                {rows.length > 0 && sameUnit && (
                  <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right">{qty(total((r) => r.opening))}</td>
                    <td className="px-3 py-2 text-right">{qty(total((r) => r.inQty))}</td>
                    <td className="px-3 py-2 text-right">{qty(total((r) => r.outQty))}</td>
                    <td className="px-3 py-2 text-right">{qty(total((r) => r.closing))}</td>
                    <td className="px-3 py-2 text-right">{total((r) => r.avgDailyUse).toFixed(1)}</td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right">{formatRs(total((r) => r.outCost))}</td>
                    <td className="px-3 py-2" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-neutral-500">
            Avg daily use = Out ÷ {report.days} day{report.days === 1 ? "" : "s"} in the period. Avg rate is the
            quantity-weighted average of the rates entered in the period. Days left uses the last 30 days&apos; use. Cost
            used only includes issues entered with a rate.
          </p>
          {rows.some((r) => r.closing < 0) && (
            <p className="text-xs text-danger">
              A negative closing balance means more was logged as issued (Out) than was ever recorded as received (In)
              for that feed — check for a missing purchase entry.
            </p>
          )}
        </>
      )}
    </div>
  );
}
