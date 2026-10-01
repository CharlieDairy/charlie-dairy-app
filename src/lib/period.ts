import { cookies } from "next/headers";
import type { PeriodKey } from "./reports/herd";
import { PERIOD_COOKIE, PERIOD_OPTIONS } from "./periodOptions";

export { PERIOD_COOKIE, PERIOD_OPTIONS };

const VALID_KEYS: string[] = PERIOD_OPTIONS.map((p) => p.key);

function isPeriodKey(v: string | undefined): v is PeriodKey {
  return !!v && VALID_KEYS.includes(v);
}

// Production Reconciliation / Customers / Milk Sales (report) / Milk Sale
// Entry are cross-linked (sidebar nav, plus the in-page links added
// alongside Milk Sale Entry), but each used its own hardcoded default
// period -- so picking "This Month" on one and navigating to another
// silently reset the range back to that page's own default. A shared
// cookie (written by each page's period selector, see
// components/PeriodPills.tsx) lets the most recently chosen period carry
// over between them. The query param always wins when present, so a direct
// or bookmarked link with ?period=... is never overridden by an older
// cookie; `fallback` only applies on a first-ever visit with neither set.
export async function resolvePeriod(paramPeriod: string | undefined, fallback: PeriodKey): Promise<PeriodKey> {
  if (isPeriodKey(paramPeriod)) return paramPeriod;
  const cookieVal = (await cookies()).get(PERIOD_COOKIE)?.value;
  if (isPeriodKey(cookieVal)) return cookieVal;
  return fallback;
}
