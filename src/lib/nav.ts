import type { ModuleName } from "@/lib/modules";

export type NavItem = { href: string; label: string };
export type NavSection = { key: string; label: string; module: ModuleName; items: NavItem[] };

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
    module: "OPERATIONS",
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
    module: "OPERATIONS",
    items: [
      { href: "/entry/breeding/heat", label: "Heat Detection" },
      { href: "/entry/breeding/ai", label: "Insemination / Service" },
      { href: "/entry/breeding/pregnancy-check", label: "Pregnancy Check" },
      { href: "/entry/breeding/calving", label: "Calving" },
      { href: "/admin/reports/breeding", label: "Breeding & Reproduction Report" },
    ],
  },
  {
    key: "health",
    label: "Health",
    module: "OPERATIONS",
    items: [
      { href: "/admin/reports/health", label: "Health Dashboard" },
      { href: "/entry/health/vaccination", label: "Vaccination Entry" },
      { href: "/entry/health/treatment", label: "Treatment Entry" },
      { href: "/admin/health/vaccines", label: "Vaccines" },
      { href: "/admin/health/medicines", label: "Medicines" },
    ],
  },
  {
    key: "milk",
    label: "Milk Production and Sale",
    module: "OPERATIONS",
    items: [
      { href: "/entry/milking", label: "Milking Entry" },
      { href: "/admin/reports/herd", label: "Milk Production by Cow" },
      { href: "/admin/reports/milk-analytics", label: "Milk Analytics" },
      { href: "/admin/reports/reconciliation", label: "Production Reconciliation" },
      { href: "/admin/customers", label: "Customers" },
      { href: "/admin/reports/milk-sales", label: "Milk Sales by Customer" },
    ],
  },
  {
    key: "weight",
    label: "Weight",
    module: "OPERATIONS",
    items: [
      { href: "/admin/reports/weight", label: "Weight Dashboard" },
      { href: "/entry/weight", label: "Weight Entry" },
      { href: "/admin/weight/standards", label: "Weight Standards" },
    ],
  },
  {
    key: "feed",
    label: "Feed & Inventory",
    module: "OPERATIONS",
    items: [
      { href: "/entry/feed", label: "Feed Entry" },
      { href: "/admin/reports/feed", label: "Feed Overview" },
      { href: "/admin/feed/items", label: "Feed Master" },
    ],
  },
  {
    key: "financial",
    label: "Financial",
    module: "FINANCIAL",
    items: [
      { href: "/entry/cash", label: "Cash Entry" },
      { href: "/admin/reports/cashflow", label: "Cash Flow" },
      { href: "/admin/reports/pl", label: "P&L Statement" },
      { href: "/admin/capital", label: "Capital Ledger" },
      { href: "/admin/assets", label: "Assets" },
    ],
  },
  {
    key: "team",
    label: "Team",
    module: "PEOPLE",
    items: [
      { href: "/admin/team", label: "Employees" },
      { href: "/admin/team/add", label: "Add Employee" },
      { href: "/entry/team/salary", label: "Salary Payment" },
      { href: "/entry/team/attendance", label: "Attendance" },
    ],
  },
  {
    key: "people",
    label: "People",
    module: "PEOPLE",
    items: [{ href: "/admin/users", label: "Users & Access" }],
  },
  {
    key: "admin",
    label: "Admin",
    module: "ADMIN",
    items: [
      { href: "/admin/master-data", label: "Master Data" },
      { href: "/admin/bulk", label: "Bulk Data" },
      { href: "/admin/audit-log", label: "Audit Log" },
    ],
  },
];

export function visibleSections(isFullAdmin: boolean, modules: ModuleName[]): NavSection[] {
  return NAV_SECTIONS.filter((s) => isFullAdmin || modules.includes(s.module));
}
