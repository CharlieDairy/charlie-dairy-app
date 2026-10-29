// Period choices for the P&L Statement, laid out like the Cash Flow Statement: pick a year (or all years), then inside the
// year pick the whole year, year to date, or one month. Pure, so the rules are tested. Months are "YYYY-MM" keys, the
// same as MonthlyPnl.month.

export type PnlSelection =
  | { range: "all"; year: null; month: null }
  | { range: "whole"; year: number; month: null }
  | { range: "ytd"; year: number; month: null }
  | { range: "month"; year: number; month: number };

type Params = { year?: string; month?: string; range?: string };

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const todayYear = (todayKey: string) => Number(todayKey.slice(0, 4));
/** 1-12: the month the year-to-date range runs up to (this month of the year, in every year, so years compare like for like). */
export const ytdMonth = (todayKey: string) => Number(todayKey.slice(5, 7));

export function parsePnlSelection(p: Params, todayKey: string): PnlSelection {
  if (p.year === "all") return { range: "all", year: null, month: null };
  const year = /^\d{4}$/.test(p.year ?? "") ? Number(p.year) : todayYear(todayKey);
  const month = Number(p.month);
  if (Number.isInteger(month) && month >= 1 && month <= 12) return { range: "month", year, month };
  if (p.range === "ytd") return { range: "ytd", year, month: null };
  return { range: "whole", year, month: null };
}

const parts = (key: string) => ({ y: Number(key.slice(0, 4)), m: Number(key.slice(5, 7)) });

/** Is this "YYYY-MM" month inside the selection? */
export function inSelection(sel: PnlSelection, monthKey: string, todayKey: string): boolean {
  const { y, m } = parts(monthKey);
  switch (sel.range) {
    case "all":
      return true;
    case "whole":
      return y === sel.year;
    case "ytd":
      return y === sel.year && m <= ytdMonth(todayKey);
    case "month":
      return y === sel.year && m === sel.month;
  }
}

export function selectionLabel(sel: PnlSelection, todayKey: string): string {
  switch (sel.range) {
    case "all":
      return "All years";
    case "whole":
      return String(sel.year);
    case "ytd":
      return `Year to date: Jan to ${MONTH_SHORT[ytdMonth(todayKey) - 1]} ${sel.year}`;
    case "month":
      return `${MONTH_LONG[sel.month - 1]} ${sel.year}`;
  }
}

/** The matching earlier period to compare against (last year for a year or year to date, the month before for a month). */
export function priorSelection(sel: PnlSelection, todayKey: string): { selection: PnlSelection; label: string } | null {
  switch (sel.range) {
    case "all":
      return null;
    case "whole":
      return { selection: { range: "whole", year: sel.year - 1, month: null }, label: String(sel.year - 1) };
    case "ytd":
      return { selection: { range: "ytd", year: sel.year - 1, month: null }, label: `Jan to ${MONTH_SHORT[ytdMonth(todayKey) - 1]} ${sel.year - 1}` };
    case "month": {
      const prev = sel.month === 1 ? { year: sel.year - 1, month: 12 } : { year: sel.year, month: sel.month - 1 };
      return { selection: { range: "month", ...prev }, label: `${MONTH_SHORT[prev.month - 1]} ${prev.year}` };
    }
  }
}

/** The link query string for a selection, matching what parsePnlSelection reads. */
export function selectionQuery(sel: PnlSelection): string {
  switch (sel.range) {
    case "all":
      return "?year=all";
    case "whole":
      return `?year=${sel.year}`;
    case "ytd":
      return `?year=${sel.year}&range=ytd`;
    case "month":
      return `?year=${sel.year}&month=${sel.month}`;
  }
}
