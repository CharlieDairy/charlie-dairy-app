import { farmDateKey } from "@/lib/reports/dashboardMetrics";

export type Severity = "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type Category =
  | "DATA_ENTRY" // someone has not entered something they should have
  | "MILK" // production, sales and reconciliation quality
  | "MONEY" // customers, cash book
  | "FEED"
  | "HERD" // animals, breeding
  | "HEALTH"
  | "TEAM"
  | "CONTROL" // sign-ins, deletes, who changed what
  | "ACCOUNTING" // the books do not describe the business correctly
  | "INTEGRITY" // records that contradict each other
  | "GAP"; // something the app cannot do or capture yet

export const CATEGORY_LABEL: Record<Category, string> = {
  DATA_ENTRY: "Missing entries",
  MILK: "Milk",
  MONEY: "Customers & cash",
  FEED: "Feed",
  HERD: "Herd & breeding",
  HEALTH: "Health",
  TEAM: "Team",
  CONTROL: "Control & security",
  ACCOUNTING: "Accounting",
  INTEGRITY: "Data integrity",
  GAP: "App gaps",
};

/** What a rule reports. `key` must be stable for the same problem so reruns update it in place. */
export type FindingDraft = {
  key: string;
  ruleId: string;
  category: Category;
  severity: Severity;
  title: string;
  detail: string;
  suggestion?: string;
  metric?: Record<string, unknown>;
  /** Only the Admin sees it (money, profit, capital). */
  financeOnly?: boolean;
  /** Once a person marks it resolved it stays resolved (used for permanent app-gap notes). */
  sticky?: boolean;
};

export type WatchContext = {
  /** Farm-local today (Asia/Karachi) as a UTC-midnight Date, matching how dates are stored. */
  today: Date;
  todayKey: string;
};

export type Rule = {
  id: string;
  run: (ctx: WatchContext) => Promise<FindingDraft[]>;
};

export function makeContext(): WatchContext {
  const todayKey = farmDateKey();
  return { todayKey, today: new Date(`${todayKey}T00:00:00.000Z`) };
}

export const DAY_MS = 86_400_000;

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

export function key(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysBetween(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / DAY_MS);
}

export function rs(n: number): string {
  return `Rs ${Math.round(n).toLocaleString("en-PK")}`;
}

/** "4 Oct, 5 Oct and 6 Oct" style list, capped so a long list stays readable. */
export function listDates(dates: string[], max = 8): string {
  const shown = dates.slice(0, max).map((d) => {
    const dt = new Date(`${d}T00:00:00Z`);
    return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  });
  return shown.join(", ") + (dates.length > max ? ` and ${dates.length - max} more` : "");
}
