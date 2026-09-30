export type NavItem = { href: string; label: string };
// `key` doubles as the granular permission module (see src/lib/permissions.ts
// PERMISSION_MODULES) -- a section is visible iff the signed-in user holds
// VIEW on that key, so there's exactly one list to keep in sync, not two.
export type NavSection = { key: string; label: string; items: NavItem[] };

// Single source of truth for the app's navigation, grouped by subject (not
// by who-can-see-it) so the journey reads the way Channab's does: Herd first
// (register an animal), then every entry form AND report for that subject
// sits together in one section -- Milking Entry next to Milk Production by
// Cow, Cash Entry next to Cash Flow, etc. Previously entry forms (/entry/*)
// and reports (/admin/*) were two disconnected areas of the app with their
// own separate navigation; this is the one list both now render from.
export const NAV_SECTIONS: NavSection[] = [
  {
    key: "herd",
    label: "Herd",
    items: [
      { href: "/admin/cows", label: "Animals" },
      { href: "/admin/cows/add", label: "Add Animal" },
      { href: "/admin/cows/import", label: "Import Animals" },
      { href: "/admin/cows/custom-fields", label: "Custom Fields" },
    ],
  },
  {
    key: "breeding",
    label: "Breeding",
    items: [
      { href: "/entry/breeding/reproduction", label: "Reproduction Entry" },
      { href: "/entry/breeding/calving", label: "Calving" },
      { href: "/admin/reports/breeding", label: "Breeding & Reproduction Report" },
    ],
  },
  {
    key: "health",
    label: "Health",
    items: [
      { href: "/admin/reports/health", label: "Health Dashboard" },
      { href: "/entry/health/vaccination", label: "Vaccination Entry" },
      { href: "/entry/health/treatment", label: "Treatment Entry" },
      { href: "/admin/health/vaccines", label: "Vaccines" },
      { href: "/admin/health/medicines", label: "Medicines" },
      { href: "/admin/health/medicines/stock", label: "Medicine Stock" },
      { href: "/admin/health/scoring", label: "Score Dashboard" },
      { href: "/admin/health/scoring/setup", label: "Scoring Setup" },
      { href: "/admin/health/schedules", label: "Health Schedules" },
      { href: "/admin/health/targets", label: "Production Targets" },
    ],
  },
  {
    key: "milk",
    label: "Milk Production and Sale",
    items: [
      { href: "/entry/milking", label: "Milking Entry" },
      { href: "/admin/reports/herd", label: "Milk Production by Cow" },
      { href: "/admin/reports/milk-analytics", label: "Milk Analytics" },
      { href: "/admin/reports/reconciliation", label: "Production Reconciliation" },
      { href: "/admin/customers", label: "Customers" },
      { href: "/admin/reports/milk-sales", label: "Milk Sales" },
    ],
  },
  {
    key: "weight",
    label: "Weight",
    items: [
      { href: "/admin/reports/weight", label: "Weight Dashboard" },
      { href: "/entry/weight", label: "Weight Entry" },
      { href: "/admin/weight/standards", label: "Weight Standards" },
    ],
  },
  {
    key: "feed",
    label: "Feed & Inventory",
    items: [
      { href: "/entry/feed", label: "Feed Entry" },
      { href: "/admin/reports/feed", label: "Feed Overview" },
      { href: "/admin/feed/items", label: "Feed Master" },
    ],
  },
  {
    key: "financial",
    label: "Financial",
    items: [
      { href: "/admin/reports/cash-register", label: "Cash Register" },
      { href: "/admin/reports/cashflow", label: "Cash Flow" },
      { href: "/admin/reports/pl", label: "P&L Statement" },
      { href: "/admin/reports/balance-sheet", label: "Balance Sheet" },
      { href: "/admin/reports/expense-breakdown", label: "Expense Breakdown" },
      { href: "/admin/reports/ar-aging", label: "AR Aging" },
      { href: "/admin/vendors", label: "Vendor Ledger" },
      { href: "/admin/capital", label: "Capital Ledger" },
      { href: "/admin/assets", label: "Assets" },
    ],
  },
  {
    key: "team",
    label: "Team",
    items: [
      { href: "/admin/team", label: "Employees" },
      { href: "/admin/team/add", label: "Add Employee" },
      { href: "/entry/team/salary", label: "Salary Payment" },
      { href: "/entry/team/attendance", label: "Attendance" },
      { href: "/admin/team/attendance-calendar", label: "Attendance Calendar" },
      { href: "/admin/team/attendance-reports", label: "Attendance Reports" },
      { href: "/entry/team/mark-absence", label: "Mark Absence" },
    ],
  },
  {
    key: "admin",
    label: "Admin",
    items: [
      { href: "/admin/users", label: "Users & Access" },
      { href: "/admin/master-data", label: "Master Data" },
      { href: "/admin/bulk", label: "Bulk Data" },
      { href: "/admin/audit-log", label: "Audit Log" },
    ],
  },
];

export function visibleSections(isFullAdmin: boolean, permissions: Set<string>): NavSection[] {
  return NAV_SECTIONS.filter((s) => isFullAdmin || permissions.has(`${s.key}:VIEW`));
}
