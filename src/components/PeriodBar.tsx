import Link from "next/link";
import { PERIOD_OPTIONS, type PeriodKey } from "@/lib/periodOptions";

// The one standard period control for the whole app, matching the design
// already proven on the admin Dashboard: preset pills plus a custom
// from/to date range with an explicit Apply button. A plain Server
// Component -- Links for the presets (instant nav, no JS needed) and a
// native GET <form> for the custom range -- so it drops into any async
// page.tsx with no client-side state. `extraParams` carries through any
// other active filter on the page (e.g. Customers' status, Milk Sales'
// buyer) so switching period never drops it.
export default function PeriodBar({
  period,
  from,
  to,
  extraParams,
}: {
  period: PeriodKey;
  from?: string;
  to?: string;
  extraParams?: Record<string, string>;
}) {
  const extra = extraParams ?? {};

  function pillHref(key: string) {
    const params = new URLSearchParams({ ...extra, period: key });
    return `?${params.toString()}`;
  }

  return (
    <form className="flex flex-wrap gap-2 items-center rounded-xl border border-border bg-white p-3">
      <span className="text-xs font-semibold text-text-muted">PERIOD</span>
      {PERIOD_OPTIONS.map((p) => (
        <Link
          key={p.key}
          href={pillHref(p.key)}
          className={`rounded-full border px-3 py-2 text-xs ${
            period === p.key ? "bg-primary text-white border-primary" : "border-border text-text-muted hover:bg-primary-light"
          }`}
        >
          {p.label}
        </Link>
      ))}
      <input type="hidden" name="period" value="custom" />
      {Object.entries(extra).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className="sr-only" htmlFor="period-from">Period from</label>
      <input className="border border-border rounded-lg p-2 text-xs" id="period-from" type="date" name="from" required defaultValue={from} />
      <label className="sr-only" htmlFor="period-to">Period to</label>
      <input className="border border-border rounded-lg p-2 text-xs" id="period-to" type="date" name="to" required defaultValue={to} />
      <button className="border border-border rounded-lg px-3 py-2 text-xs font-medium hover:bg-primary-light" type="submit">
        Apply period
      </button>
    </form>
  );
}
