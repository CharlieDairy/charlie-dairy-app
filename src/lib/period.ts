import { cookies } from "next/headers";
import { PERIOD_COOKIE, PERIOD_FROM_COOKIE, PERIOD_TO_COOKIE, isPeriodKey, type PeriodKey } from "./periodOptions";

export { PERIOD_COOKIE, PERIOD_FROM_COOKIE, PERIOD_TO_COOKIE, PERIOD_OPTIONS, type PeriodKey } from "./periodOptions";

export type ResolvedPeriod = { period: PeriodKey; from?: string; to?: string };

// The report pages that filter by period (Reconciliation, Customers, Milk
// Sales, Milking Entry, Herd, Cash Register, Expense Breakdown, Attendance,
// Cow Profile, Vendors, Milk Sale Entry -- effectively every page with a
// <PeriodBar>) are cross-linked via the sidebar and various in-page links,
// but each used to default independently -- so picking "This month" on one
// and navigating to another silently reset the range back to that page's
// own default. middleware.ts writes cd_period/cd_period_from/cd_period_to
// cookies whenever a request carries a `period` query param (see its
// comment), and this reads them back as the fallback whenever a page's own
// query params are absent. The query param always wins when present, so a
// direct or bookmarked link is never overridden by an older cookie choice;
// `fallback` only applies on a first-ever visit with neither set.
export async function resolvePeriod(
  params: { period?: string; from?: string; to?: string },
  fallback: PeriodKey
): Promise<ResolvedPeriod> {
  const jar = await cookies();
  const period = isPeriodKey(params.period)
    ? params.period
    : isPeriodKey(jar.get(PERIOD_COOKIE)?.value)
      ? (jar.get(PERIOD_COOKIE)!.value as PeriodKey)
      : fallback;
  const from = params.from ?? jar.get(PERIOD_FROM_COOKIE)?.value;
  const to = params.to ?? jar.get(PERIOD_TO_COOKIE)?.value;
  return { period, from, to };
}
