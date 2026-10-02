// The one standard period control for the whole app, matching the design
// already proven on the admin Dashboard (src/app/admin/page.tsx): seven
// preset pills plus a custom from/to date range with an explicit Apply
// button. Every page that filters by period uses this same key set and the
// same shared <PeriodBar> component (src/components/PeriodBar.tsx) -- no
// page-local option list or bespoke selector.
export type PeriodKey = "day" | "week" | "month" | "last-month" | "quarter" | "year" | "last-year" | "custom";

export const PERIOD_COOKIE = "cd_period";
export const PERIOD_FROM_COOKIE = "cd_period_from";
export const PERIOD_TO_COOKIE = "cd_period_to";

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "day", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "quarter", label: "Last 3 months" },
  { key: "year", label: "This year" },
  { key: "last-year", label: "Last year" },
];

export const PERIOD_KEYS: readonly PeriodKey[] = [...PERIOD_OPTIONS.map((p) => p.key), "custom"];

export function isPeriodKey(v: string | undefined | null): v is PeriodKey {
  return !!v && (PERIOD_KEYS as readonly string[]).includes(v);
}
