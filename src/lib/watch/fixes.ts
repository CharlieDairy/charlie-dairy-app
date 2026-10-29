// Where to go to fix each Farm Watch finding. Pure and read-only: the page shows these as buttons, and a button is only
// offered as a link when the signed-in role can open that page (otherwise it says to ask the Admin).
import { roleCanOpenPath } from "@/lib/modules";

export type FixLink = { label: string; href: string };

type Input = { ruleId: string; key: string; metric: unknown };

const sheet = (date: string, label?: string): FixLink => ({ label: label ?? `Open the Daily Record Sheet for ${shortDate(date)}`, href: `/entry/daily?date=${date}` });
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function shortDate(key: string): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Up to `max` valid YYYY-MM-DD strings from a metric value (an array of strings or of { date } objects). */
function datesFrom(value: unknown, max = 4): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    const d = typeof v === "string" ? v : (v as { date?: unknown } | null)?.date;
    if (typeof d === "string" && DAY.test(d) && !out.includes(d)) out.push(d);
    if (out.length >= max) break;
  }
  return out;
}

const CASH = { label: "Open the Cash Register", href: "/admin/reports/cash-register" };
const CASH_ENTRY = { label: "Add a Cash Entry", href: "/entry/cash" };
const TODAY_SHEET = { label: "Open today's Daily Record Sheet", href: "/entry/daily" };
const ANIMALS = { label: "Open Animals", href: "/admin/cows" };

export function fixLinks(f: Input): FixLink[] {
  const m = (f.metric ?? {}) as Record<string, unknown>;
  switch (f.ruleId) {
    // ---- entries nobody has made ----
    case "milk.missing-days":
      return datesFrom(m.missingDates).map((d) => sheet(d));
    case "milk.incomplete-days":
      return datesFrom(m.days).map((d) => sheet(d));
    case "sales.missing-days":
      return datesFrom(m.dates).map((d) => sheet(d));
    case "cash.stale":
      return [CASH_ENTRY];
    case "feed.stale":
      return [TODAY_SHEET, { label: "Open Feed Entry", href: "/entry/feed" }];
    case "team.attendance-stale":
      return [{ label: "Mark attendance", href: "/entry/team/attendance" }];

    // ---- feed ----
    case "feed.negative-stock":
      return [{ label: "Record feed received", href: "/entry/feed" }, { label: "Open Feed Overview", href: "/admin/reports/feed" }];
    case "feed.days-left":
      return [{ label: "Record a feed purchase", href: "/entry/feed" }];
    case "feed.uncosted": {
      const feeds = Array.isArray(m.feeds) ? (m.feeds as { feed?: unknown }[]).map((x) => x.feed).filter((x): x is string => typeof x === "string") : [];
      const links = feeds.map((name) => ({ label: `Fix ${name} entries (Feed Overview)`, href: `/admin/reports/feed?feed=${encodeURIComponent(name)}` }));
      return links.length > 0 ? links : [{ label: "Open Feed Overview", href: "/admin/reports/feed" }];
    }

    // ---- herd, breeding, health ----
    case "health.vaccination-overdue":
      return [{ label: "Record a vaccination", href: "/entry/health/vaccination" }, { label: "Open Health Dashboard", href: "/admin/reports/health" }];
    case "breeding.pd-due":
      return [{ label: "Record a pregnancy check", href: "/entry/breeding/pregnancy-check" }];
    case "breeding.calving-and-dry-off":
      return f.key === "breeding.dry-off-due" ? [ANIMALS] : [{ label: "Record a calving", href: "/entry/breeding/calving" }, { label: "Open Breeding report", href: "/admin/reports/breeding" }];
    case "herd.no-milk":
      return [TODAY_SHEET, { label: "Check the animals' status", href: "/admin/cows" }];
    case "herd.status-mismatch":
      return [ANIMALS];
    case "health.withdrawal":
      return [{ label: "Open Health Dashboard", href: "/admin/reports/health" }];
    case "weight.stale":
      return [{ label: "Record weights", href: "/entry/weight" }];

    // ---- records that contradict each other ----
    case "data.future-dated":
      return [{ label: "Check Milking Entry", href: "/entry/milking?period=month" }, { label: "Check Milk Sales", href: "/admin/reports/milk-sales" }, CASH];
    case "data.duplicate-milking":
      return [{ label: "Open Milking Entry (Admin removes the duplicate)", href: "/entry/milking?period=month" }];
    case "data.unknown-buyers":
      return [{ label: "Open Customers", href: "/admin/customers" }, { label: "Open Milk Sales", href: "/admin/reports/milk-sales" }];
    case "data.feed-names":
      return [{ label: "Open Feed Master", href: "/admin/feed/items" }, { label: "Open Feed Overview", href: "/admin/reports/feed" }];
    case "data.orphan-payments":
      return [{ label: "Open Milk Sales and payments", href: "/admin/reports/milk-sales" }, CASH];

    // ---- quality ----
    case "milk.outlier": {
      const records = Array.isArray(m.records) ? (m.records as { tag?: unknown; date?: unknown }[]) : [];
      const links: FixLink[] = [];
      for (const r of records) {
        if (typeof r.date !== "string" || !DAY.test(r.date)) continue;
        links.push({ label: `Check Tag ${typeof r.tag === "string" ? r.tag : "?"} on ${shortDate(r.date)}`, href: `/entry/milking?date=${r.date}` });
        if (links.length >= 4) break;
      }
      return links.length > 0 ? links : [{ label: "Open Milking Entry", href: "/entry/milking" }];
    }
    case "sale.rate-mismatch":
      return [{ label: "Open Milk Sales", href: "/admin/reports/milk-sales" }, { label: "Open Customers", href: "/admin/customers" }];
    case "recon.variance":
      return [{ label: "Open the milk reconciliation", href: "/admin/reports/reconciliation" }, TODAY_SHEET];
    case "ar.overdue":
      return [{ label: "Open Customers who owe", href: "/admin/reports/ar-aging" }, { label: "Record a payment", href: "/admin/reports/milk-sales" }];
    case "cash.uncategorised":
    case "cash.duplicates":
      return [CASH];

    // ---- accounting ----
    case "acct.review-class":
    case "acct.transfer-imbalance":
      return [CASH];
    case "acct.unlinked-receipts":
      return [{ label: "Open Milk Sales and payments", href: "/admin/reports/milk-sales" }, CASH];
    case "acct.sales-vs-receipts":
      return [CASH, CASH_ENTRY];
    case "acct.balance-sheet":
      return [{ label: "Open the Balance Sheet", href: "/admin/reports/balance-sheet" }, CASH];

    // ---- control ----
    case "auth.failed-logins":
    case "audit.bulk-deletes":
      return [{ label: "Open the Audit Log", href: "/admin/audit-log" }];
    case "users.stale":
      return [{ label: "Open Users", href: "/admin/users" }];

    // ---- app gaps worth acting on ----
    case "gap.team-unused":
      return [{ label: "Open Team", href: "/admin/team" }];
    case "gap.vendors-unused":
      return [{ label: "Open Vendors", href: "/admin/vendors" }];
    case "gap.unconfirmed-status":
      return [ANIMALS];
    case "gap.static":
      return f.key === "gap.backup" ? [{ label: "Open Backups", href: "/admin/backups" }] : [];
    default:
      return [];
  }
}

/** Splits the fixes into the ones this role can open and a count of the ones only an Admin can open. */
export function fixesForRole(f: Input, role: string | undefined): { open: FixLink[]; adminOnly: number } {
  const all = fixLinks(f);
  const open = all.filter((l) => roleCanOpenPath(role, l.href.split("?")[0]));
  return { open, adminOnly: all.length - open.length };
}
