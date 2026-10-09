// How the farm's cash entries are counted in the books (cash basis).
//
// Every Cash Register entry belongs to one "accounting class". The class decides
// where the money shows up: income and operating costs go into the P&L; capital
// spending, money from / to the partners and the opening balance do NOT (they
// move cash but are not profit or loss). The class is worked out from the
// category and the remark; an Admin can override it on any entry (the stored
// `accountClass` column), and that override always wins.

export const CASH_CLASSES = [
  "MILK_SALES",
  "LIVESTOCK_SALES",
  "OTHER_INCOME",
  "OPEX",
  "CAPEX",
  "PARTNER_IN",
  "PARTNER_OUT",
  "OPENING",
  "TRANSFER",
  "REVIEW",
] as const;
export type CashClassKey = (typeof CASH_CLASSES)[number];

export const CLASS_LABEL: Record<CashClassKey, string> = {
  MILK_SALES: "Milk sales",
  LIVESTOCK_SALES: "Animal & calf sales",
  OTHER_INCOME: "Other income",
  OPEX: "Operating cost",
  CAPEX: "Capital spending",
  PARTNER_IN: "Money from partners",
  PARTNER_OUT: "Money to partners",
  OPENING: "Opening balance",
  TRANSFER: "Transfer between books",
  REVIEW: "Needs review",
};

export const INCOME_CLASSES: readonly CashClassKey[] = ["MILK_SALES", "LIVESTOCK_SALES", "OTHER_INCOME"];

export type ClassifiableRow = {
  category: string | null;
  amountIn: number;
  amountOut: number;
  remark?: string | null;
  accountClass?: string | null;
};

const MILK_CATEGORIES = new Set(["cash sale proceed for milk", "milk sale payment"]);

/** Class of one entry. Returns REVIEW when it cannot be decided safely. */
export function classifyCash(row: ClassifiableRow): CashClassKey {
  if (row.accountClass && (CASH_CLASSES as readonly string[]).includes(row.accountClass)) return row.accountClass as CashClassKey;

  const cat = (row.category ?? "").trim().toLowerCase();
  const remark = (row.remark ?? "").toLowerCase();
  const isIn = row.amountIn > 0 && row.amountOut === 0;
  const isOut = row.amountOut > 0 && row.amountIn === 0;

  if (cat === "opening balance") return "OPENING";

  // A correction entered as "wrong entry": it reverses an earlier entry of the same kind, so it
  // takes that entry's class and the two cancel out.
  if (/wrong\s*ent/.test(remark)) return /milk/.test(remark) ? "MILK_SALES" : "OPEX";

  // Money moved to / from a partner is never profit or loss, whatever category it was filed under.
  if (isOut && /(transfer(red)?|send|sent|payment)[^.]{0,60}\babid\b|\babid\s*(sb|sahib)?\s*account\b/.test(remark)) return "PARTNER_OUT";
  if (isIn && /(received|recived|recieved)\s+from\s+(abid|hafiz)/.test(remark)) return "PARTNER_IN";

  // ---- Bank account entries (Meezan) ----
  if (cat === "phase 3") return isIn ? "PARTNER_IN" : "CAPEX"; // Phase III funds in; cow purchases out
  if (cat === "investment phiii") return isIn ? "PARTNER_IN" : "PARTNER_OUT";
  if (isOut && /\bland payment\b/.test(remark)) return "CAPEX";
  // Bank -> the farm manager's petty cash: the same money, moved between the farm's own books.
  if (isOut && /(petty cash( withdr[a-z]*)?\s+to\s+(ab|a basit|basit|abdul baist)\b|(trf|cash trf|transfer)( for [a-z0-9 ]+)?\s+to\s+(ab|a basit|abdul baist|basit)\b)/.test(remark)) return "TRANSFER";
  // Cash a partner takes out of the bank, or settles with the farm.
  if (isOut && /(cash by hafiz|to hafiz|withdrawl via chq|final settlement of hafiz)/.test(remark)) return "PARTNER_OUT";
  if (isIn && /(cow sale|bull breeder|breeder sale)/.test(remark)) return "LIVESTOCK_SALES";
  if (isIn && (cat === "sale" || cat === "milk" || /milk (collection|payment|sale)|engro|loyalty incentive/.test(remark))) return "MILK_SALES";
  if (isIn && /(trf from abid|cash by hafiz|hafiz shb|cash from obaid|mohsin share|palai payment|payment obaid|\bmaaz\b|payable to abid|trf from ph|money received from|deposit by)/.test(remark)) return "PARTNER_IN";

  if (cat === "cash from company") return isOut ? "PARTNER_OUT" : "PARTNER_IN";
  if (cat === "capex") return "CAPEX";
  if (MILK_CATEGORIES.has(cat)) return isIn ? "MILK_SALES" : "REVIEW";
  if (/^cash sale proceed for (cows|calves)/.test(cat)) return isIn ? "LIVESTOCK_SALES" : "REVIEW";
  if (cat === "cash recived other" || cat === "cash received other") return isIn ? "OTHER_INCOME" : "REVIEW";

  // Everything the farm spends on running: Opex..., salaries and advances, supplements, AI, vaccination, agri.
  if (/^(opex|advance salary|feed supliment|feed supplement|a\.i|vaccination|mobilization|correction|agri)/.test(cat)) return "OPEX";

  // No usable category: money out is counted as a cost (so profit is not flattered) but flagged elsewhere;
  // money in is NOT counted as income until someone classifies it.
  if (cat === "" || cat === "uncategorized") {
    if (isOut) return "OPEX";
    if (isIn && /milk/.test(remark)) return "MILK_SALES";
    return "REVIEW";
  }

  // A category we have not seen: costs count as costs, receipts wait for review.
  return isOut ? "OPEX" : "REVIEW";
}

/** Signed effect of an entry on its own class: income classes count money in minus money out, costs the reverse. */
export function netOf(cls: CashClassKey, amountIn: number, amountOut: number): number {
  if (INCOME_CLASSES.includes(cls)) return amountIn - amountOut;
  if (cls === "OPEX" || cls === "CAPEX" || cls === "PARTNER_OUT") return amountOut - amountIn;
  return amountIn - amountOut;
}
