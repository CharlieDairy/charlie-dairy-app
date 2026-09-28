// Single source of truth for the app's 4 access modules — used by the JWT
// (auth.ts), route gating (middleware.ts), nav filtering (admin/layout.tsx),
// and the grant UI (admin/users).
export const MODULES = ["OPERATIONS", "FINANCIAL", "PEOPLE", "ADMIN"] as const;
export type ModuleName = (typeof MODULES)[number];

export const MODULE_LABELS: Record<ModuleName, string> = {
  OPERATIONS: "Operations",
  FINANCIAL: "Financial",
  PEOPLE: "People",
  ADMIN: "Admin",
};

export const MODULE_DESCRIPTIONS: Record<ModuleName, string> = {
  OPERATIONS: "Herd, Breeding, Milk and Feed sections — animal records, all breeding/milking/feed entry forms, and their reports",
  FINANCIAL: "Financial section — Cash Entry, Cash Flow, P&L Statement, Capital Ledger, Assets",
  PEOPLE: "Users & Access, and the Team section — employees, salary payments, attendance",
  ADMIN: "Master Data, Bulk Data, Audit Log",
};

// Longest-prefix match wins, so list more specific paths before their parents
// isn't required here since none of these overlap as prefixes of each other.
const PATH_MODULES: { prefix: string; module: ModuleName }[] = [
  { prefix: "/admin/cows", module: "OPERATIONS" },
  { prefix: "/admin/reports/breeding", module: "OPERATIONS" },
  { prefix: "/admin/reports/herd", module: "OPERATIONS" },
  { prefix: "/admin/reports/reconciliation", module: "OPERATIONS" },
  { prefix: "/admin/reports/milk-sales", module: "OPERATIONS" },
  { prefix: "/admin/reports/feed", module: "OPERATIONS" },
  { prefix: "/admin/reports/health", module: "OPERATIONS" },
  { prefix: "/admin/health", module: "OPERATIONS" },
  { prefix: "/admin/reports/weight", module: "OPERATIONS" },
  { prefix: "/admin/weight", module: "OPERATIONS" },
  { prefix: "/admin/capital", module: "FINANCIAL" },
  { prefix: "/admin/assets", module: "FINANCIAL" },
  { prefix: "/admin/reports/pl", module: "FINANCIAL" },
  { prefix: "/admin/reports/cashflow", module: "FINANCIAL" },
  { prefix: "/admin/users", module: "PEOPLE" },
  { prefix: "/admin/team", module: "PEOPLE" },
  { prefix: "/admin/master-data", module: "ADMIN" },
  { prefix: "/admin/bulk", module: "ADMIN" },
  { prefix: "/admin/audit-log", module: "ADMIN" },
  // Data Entry forms (/entry/*) -- previously ungated server-side (only
  // hidden from nav), so a user could reach any form by URL regardless of
  // their granted modules. Same module per subject as its admin/report
  // counterpart above, so a Financial-only user genuinely can't submit
  // Milking/Breeding/Feed entries and vice versa.
  { prefix: "/entry/milking", module: "OPERATIONS" },
  { prefix: "/entry/feed", module: "OPERATIONS" },
  { prefix: "/entry/milk-sale", module: "OPERATIONS" },
  { prefix: "/entry/breeding", module: "OPERATIONS" },
  { prefix: "/entry/health", module: "OPERATIONS" },
  { prefix: "/entry/weight", module: "OPERATIONS" },
  { prefix: "/entry/cash", module: "FINANCIAL" },
  { prefix: "/entry/team", module: "PEOPLE" },
];

/** Returns the module a given /admin path requires, or null if it needs no specific module (e.g. the dashboard itself). */
export function moduleForPath(pathname: string): ModuleName | null {
  const match = PATH_MODULES.find((p) => pathname === p.prefix || pathname.startsWith(p.prefix + "/"));
  return match?.module ?? null;
}

export function isValidModule(value: string): value is ModuleName {
  return (MODULES as readonly string[]).includes(value);
}
