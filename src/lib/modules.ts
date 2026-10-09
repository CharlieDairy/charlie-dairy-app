// Maps a path to the granular permission module (a NAV_SECTIONS key, see
// src/lib/nav.ts and src/lib/permissions.ts) it requires VIEW on. Used by:
// middleware.ts (coarse, JWT-based first-pass gate) and entry/page.tsx
// (tile filtering). The authoritative, live per-action check for writes
// happens in each server action via requirePermission() (src/lib/access.ts)
// -- this file only decides "is this path even reachable at all".
//
// Longest-prefix match wins, so list more specific paths before their
// parents isn't required here since none of these overlap as prefixes of
// each other.
import type { PermissionModuleKey } from "@/lib/permissions";

export type { PermissionModuleKey as ModuleName };

const PATH_MODULES: { prefix: string; module: PermissionModuleKey }[] = [
  { prefix: "/admin/cows", module: "herd" },
  { prefix: "/admin/reports/breeding", module: "breeding" },
  { prefix: "/entry/breeding", module: "breeding" },
  { prefix: "/admin/reports/health", module: "health" },
  { prefix: "/admin/health", module: "health" },
  { prefix: "/entry/health", module: "health" },
  { prefix: "/admin/reports/herd", module: "milk" }, // "Milk Production by Cow" report
  { prefix: "/admin/reports/milk-analytics", module: "milk" },
  { prefix: "/admin/reports/reconciliation", module: "milk" },
  { prefix: "/admin/reports/milk-sales", module: "milk" },
  { prefix: "/admin/customers", module: "milk" },
  { prefix: "/entry/milking", module: "milk" },
  { prefix: "/entry/milk-sale", module: "milk" },
  { prefix: "/entry/milk-usage", module: "milk" },
  { prefix: "/admin/reports/weight", module: "weight" },
  { prefix: "/admin/weight", module: "weight" },
  { prefix: "/entry/weight", module: "weight" },
  { prefix: "/admin/reports/feed", module: "feed" },
  { prefix: "/admin/feed", module: "feed" },
  { prefix: "/entry/feed", module: "feed" },
  { prefix: "/admin/capital", module: "financial" },
  { prefix: "/admin/assets", module: "financial" },
  { prefix: "/admin/vendors", module: "financial" },
  { prefix: "/admin/reports/pl", module: "financial" },
  { prefix: "/admin/reports/cashflow", module: "financial" },
  { prefix: "/admin/reports/balance-sheet", module: "financial" },
  { prefix: "/admin/reports/expense-breakdown", module: "financial" },
  { prefix: "/admin/reports/ar-aging", module: "financial" },
  { prefix: "/entry/cash", module: "financial" },
  { prefix: "/admin/reports/cash-register", module: "financial" },
  { prefix: "/admin/team", module: "team" },
  { prefix: "/entry/team", module: "team" },
  { prefix: "/admin/users", module: "admin" },
  { prefix: "/admin/master-data", module: "admin" },
  { prefix: "/admin/bulk", module: "admin" },
  { prefix: "/admin/audit-log", module: "admin" },
];

export type AppRole = "ADMIN" | "EDITOR" | "VIEWER" | "PARTNER";

// Pages only an Admin may open. Editors and View-Only users get everything
// else (read for View Only; read/write/edit/delete for Editors) but never the
// Admin panel, P&L, Balance Sheet, Capital Ledger, Assets or Cash Flow.
const ADMIN_PANEL_PREFIXES = ["/admin/users", "/admin/master-data", "/admin/bulk", "/admin/audit-log"];

// The finance statements: closed to Editors and View Only users, open (to read) to Partners.
const FINANCE_STATEMENT_PREFIXES = [
  "/admin/reports/pl",
  "/admin/reports/balance-sheet",
  "/admin/reports/cashflow",
  "/admin/capital",
  "/admin/assets",
];

const matches = (list: string[], pathname: string) => list.some((p) => pathname === p || pathname.startsWith(p + "/"));

export function isAdminPanelPath(pathname: string): boolean {
  return matches(ADMIN_PANEL_PREFIXES, pathname);
}

export function isAdminOnlyPath(pathname: string): boolean {
  return isAdminPanelPath(pathname) || matches(FINANCE_STATEMENT_PREFIXES, pathname);
}

// A View-Only user can't use any data-entry form or "add" page -- they read
// the same information through the reports and lists instead.
export function isWritePath(pathname: string): boolean {
  return (
    pathname === "/entry" ||
    pathname.startsWith("/entry/") ||
    ["/admin/cows/add", "/admin/cows/import", "/admin/team/add"].some((p) => pathname === p)
  );
}

/** Where a user lands after sign-in: Editors work from the data-entry menu; Admin and View Only from the dashboard. */
export function homeFor(role: string | undefined): string {
  return role === "EDITOR" ? "/entry" : "/admin";
}

/** True if a signed-in user with this role may open this path at all. */
export function roleCanOpenPath(role: string | undefined, pathname: string): boolean {
  if (role === "ADMIN") return true;
  if (role === "PARTNER") return !isAdminPanelPath(pathname) && !isWritePath(pathname);
  if (isAdminOnlyPath(pathname)) return false;
  if (role === "VIEWER" && isWritePath(pathname)) return false;
  return role === "EDITOR" || role === "VIEWER";
}

/** Returns the permission module a given path requires VIEW on, or null if it needs none (e.g. the dashboard itself). */
export function moduleForPath(pathname: string): PermissionModuleKey | null {
  const match = PATH_MODULES.find((p) => pathname === p.prefix || pathname.startsWith(p.prefix + "/"));
  return match?.module ?? null;
}
