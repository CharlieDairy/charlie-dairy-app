import type { PeriodKey } from "./reports/herd";

// Pure constants, safe to import from client components (see components/
// PeriodPills.tsx and the FilterBar/PeriodSelect variants) -- lib/period.ts
// re-exports these alongside resolvePeriod(), which needs next/headers and
// so can only be imported from Server Components.
export const PERIOD_COOKIE = "cd_period";

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "day", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "all", label: "All Time" },
];
