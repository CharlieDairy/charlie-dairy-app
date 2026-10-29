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
      <p className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
        <b>First-in, first-out costing.</b> Every purchase is a layer of stock at the rate paid for it. Whatever is used is
        costed from the oldest layer that still has stock, and moves on to the next layer when it runs out. The feed cost
        and the value of the stock left both come from those layers.
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
            <StatCard label="Opening stock value" value={formatRs(selectedRow.openingValue)} />
            <StatCard label="Purchases (at their rates)" value={selectedRow.purchaseValue > 0 ? formatRs(selectedRow.purchaseValue) : "None"} tone="positive" />
            <StatCard label="Cost of feed used (FIFO)" value={selectedRow.outCost > 0 ? formatRs(selectedRow.outCost) : "Not costed"} />
            <StatCard label="Closing stock value (FIFO)" value={formatRs(selectedRow.closingValue)} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label={`Avg daily use (${report.days} day${report.days === 1 ? "" : "s"})`} value={`${selectedRow.avgDailyUse.toFixed(1)} ${unitLabel}`} />
            <StatCard label="Avg cost of what was used" value={selectedRow.avgRate !== null ? `${rs2(selectedRow.avgRate)} / ${unitLabel || "unit"}` : "Not costed"} />
            <StatCard label="Cost of stock left" value={selectedRow.closingAvgCost !== null ? `${rs2(selectedRow.closingAvgCost)} / ${unitLabel || "unit"}` : "—"} />
            <StatCard
              label="Stock status"
              value={selectedRow.lowStock ? "Low stock" : stockTone(selectedRow.closing, selectedRow.daysLeft).label}
              tone={selectedRow.lowStock || selectedRow.closing < 0 ? "negative" : undefined}
            />
          </div>
          {(selectedRow.estimatedUseQty > 0 || selectedRow.unpricedUseQty > 0 || selectedRow.unratedPurchaseQty > 0) && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {selectedRow.unratedPurchaseQty > 0 && <>{qty(selectedRow.unratedPurchaseQty)} {unitLabel} received in this period has no purchase rate. </>}
              {selectedRow.estimatedUseQty > 0 && <>{qty(selectedRow.estimatedUseQty)} {unitLabel} used in this period was costed at an estimated rate (no purchase rate on record, or more used than was ever received). </>}
              {selectedRow.unpricedUseQty > 0 && <>{qty(selectedRow.unpricedUseQty)} {unitLabel} used has no cost at all. </>}
              {isAdmin ? "Edit the purchase below and enter the rate paid, and every cost after it is recalculated." : "Ask the Admin to enter the missing purchase rates."}
            </p>
          )}

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
          />
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">Stock on hand at the end of the period, oldest first</h2>
            <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-100">
                  <tr>
                    <th className="text-center px-4 py-2 whitespace-nowrap">Bought on</th>
                    <th className="text-center px-4 py-2 whitespace-nowrap">Bought ({unitLabel})</th>
                    <th className="text-center px-4 py-2 whitespace-nowrap">Left ({unitLabel})</th>
                    <th className="text-center px-4 py-2 whitespace-nowrap">Rate</th>
                    <th className="text-center px-4 py-2 whitespace-nowrap">Value of what is left</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.layers ?? []).map((l, i) => (
                    <tr key={`${l.date}-${i}`} className="border-t border-neutral-100">
                      <td className="px-4 py-2 text-center whitespace-nowrap">{l.date}</td>
                      <td className="px-4 py-2 text-center whitespace-nowrap">{qty(l.received)}</td>
                      <td className="px-4 py-2 text-center whitespace-nowrap font-medium">{qty(l.remaining)}</td>
                      <td className="px-4 py-2 text-center whitespace-nowrap">
                        {l.rate !== null ? rs2(l.rate) : l.valueRate !== null ? <span className="text-amber-700" title="No purchase rate recorded; valued at the latest known rate">{rs2(l.valueRate)} (estimate)</span> : "—"}
                      </td>
                      <td className="px-4 py-2 text-center whitespace-nowrap">{formatRs(l.value)}</td>
                    </tr>
                  ))}
                  {(report.layers ?? []).length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-neutral-500">No stock left, or no purchases recorded.</td></tr>
                  )}
                  {(report.layers ?? []).length > 0 && (
                    <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold">
                      <td className="px-4 py-2 text-center">Total</td>
                      <td />
                      <td className="px-4 py-2 text-center whitespace-nowrap">{qty((report.layers ?? []).reduce((n, l) => n + l.remaining, 0))}</td>
                      <td />
                      <td className="px-4 py-2 text-center whitespace-nowrap">{formatRs((report.layers ?? []).reduce((n, l) => n + l.value, 0))}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          {selectedRow.closing < 0 && (
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
            <StatCard label="Feed cost in period (FIFO)" value={formatRs(total((r) => r.outCost))} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Opening stock value" value={formatRs(total((r) => r.openingValue))} />
            <StatCard label="Purchases in period" value={formatRs(total((r) => r.purchaseValue))} tone="positive" />
            <StatCard label="Closing stock value (FIFO)" value={formatRs(total((r) => r.closingValue))} />
            <StatCard label="Feeds without a full cost" value={String(rows.filter((r) => r.estimatedUseQty > 0 || r.unpricedUseQty > 0 || r.unratedPurchaseQty > 0).length)} tone={rows.some((r) => r.unpricedUseQty > 0) ? "negative" : undefined} />
          </div>

          <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="text-center px-4 py-2 whitespace-nowrap">Feed</th>
                  <th className="text-center px-4 py-2 whitespace-nowrap">Opening</th>
                  <th className="text-center px-4 py-2 whitespace-nowrap">In</th>
                  <th className="text-center px-4 py-2 whitespace-nowrap">Out</th>
                  <th className="text-center px-4 py-2 whitespace-nowrap">Closing</th>
                  <th className="text-center px-4 py-2 whitespace-nowrap">Avg daily use</th>
                  <th className="text-center px-4 py-2 whitespace-nowrap">Cost per unit used</th>
                  <th className="text-center px-4 py-2 whitespace-nowrap">Cost used (FIFO)</th>
                  <th className="text-center px-4 py-2 whitespace-nowrap">Stock value</th>
                  <th className="text-center px-4 py-2 whitespace-nowrap">Stock status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const status = stockTone(r.closing, r.daysLeft);
                  return (
                    <tr key={r.feedType} className="border-t border-neutral-100">
                      <td className="px-4 py-2 text-center whitespace-nowrap font-medium">
                        <Link href={feedHref(r.feedType)} className="text-primary hover:underline">{r.feedType}</Link>
                        {r.unit && <span className="ml-1 text-xs text-neutral-400">{r.unit}</span>}
                        {!r.inMaster && <span className="ml-1 text-xs text-warning" title="Not in Feed Master">(not in master)</span>}
                      </td>
                      <td className="px-4 py-2 text-center whitespace-nowrap">{qty(r.opening)}</td>
                      <td className="px-4 py-2 text-center whitespace-nowrap text-green-700">{qty(r.inQty)}</td>
                      <td className="px-4 py-2 text-center whitespace-nowrap">{qty(r.outQty)}</td>
                      <td className={`px-4 py-2 text-center whitespace-nowrap font-medium ${r.closing < 0 ? "text-danger" : ""}`}>{qty(r.closing)}</td>
                      <td className="px-4 py-2 text-center whitespace-nowrap">{r.avgDailyUse.toFixed(1)}</td>
                      <td className="px-4 py-2 text-center whitespace-nowrap">{r.avgRate !== null ? rs2(r.avgRate) : "—"}</td>
                      <td className="px-4 py-2 text-center whitespace-nowrap">
                        {r.outCost > 0 ? formatRs(r.outCost) : "—"}
                        {(r.estimatedUseQty > 0 || r.unpricedUseQty > 0) && <span className="ml-1 text-amber-700" title="Part of this cost uses an estimated rate or is missing a purchase rate">*</span>}
                      </td>
                      <td className="px-4 py-2 text-center whitespace-nowrap">{r.closingValue > 0 ? formatRs(r.closingValue) : "—"}</td>
                      <td className="px-4 py-2 text-center">
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
                    <td colSpan={10} className="px-4 py-6 text-center text-neutral-500">
                      No feeds yet. Add them in Feed Master, then record entries.
                    </td>
                  </tr>
                )}
                {rows.length > 0 && sameUnit && (
                  <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold">
                    <td className="px-4 py-2 text-center">Total</td>
                    <td className="px-4 py-2 text-center whitespace-nowrap">{qty(total((r) => r.opening))}</td>
                    <td className="px-4 py-2 text-center whitespace-nowrap">{qty(total((r) => r.inQty))}</td>
                    <td className="px-4 py-2 text-center whitespace-nowrap">{qty(total((r) => r.outQty))}</td>
                    <td className="px-4 py-2 text-center whitespace-nowrap">{qty(total((r) => r.closing))}</td>
                    <td className="px-4 py-2 text-center whitespace-nowrap">{total((r) => r.avgDailyUse).toFixed(1)}</td>
                    <td className="px-4 py-2 text-center" />
                    <td className="px-4 py-2 text-center whitespace-nowrap">{formatRs(total((r) => r.outCost))}</td>
                    <td className="px-4 py-2 text-center whitespace-nowrap">{formatRs(total((r) => r.closingValue))}</td>
                    <td className="px-4 py-2 text-center" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-neutral-500">
            Avg daily use = Out ÷ {report.days} day{report.days === 1 ? "" : "s"} in the period. Cost used is worked out
            first-in, first-out: each issue takes the rate of the oldest purchase that still has stock. Stock value is
            what is left, at the rates of the purchases it came from. Days left uses the last 30 days&apos; use. A * means
            part of the cost uses an estimated rate because a purchase has no rate recorded; open the feed to see which.
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
