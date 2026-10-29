// Pure helpers for the Daily Record Sheet (src/app/entry/daily): compare what the sheet holds with what is
// already saved for the day, so saving twice never doubles anything and a corrected number updates in place.

export type Saved = { id: string; value: number };
export type NumberPlan = {
  create: string[];
  update: { id: string; key: string; value: number }[];
  /** keys that already have more than one saved row for the day: left alone and reported */
  ambiguous: string[];
  unchanged: number;
};

/**
 * `saved` maps a key (e.g. "cowId|MORNING" or a customer) to the rows already saved for the day;
 * `wanted` holds the numbers typed on the sheet. A blank box is simply not in `wanted`, so it changes nothing.
 */
export function planNumbers(saved: Map<string, Saved[]>, wanted: Map<string, number>): NumberPlan {
  const plan: NumberPlan = { create: [], update: [], ambiguous: [], unchanged: 0 };
  for (const [key, value] of wanted) {
    const rows = saved.get(key) ?? [];
    if (rows.length === 0) plan.create.push(key);
    else if (rows.length > 1) plan.ambiguous.push(key);
    else if (Math.abs(rows[0].value - value) < 1e-9) plan.unchanged++;
    else plan.update.push({ id: rows[0].id, key, value });
  }
  return plan;
}

/** Tags sort as numbers when they are numbers ("9" before "47"), otherwise as text. */
export function compareTags(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return a.localeCompare(b, undefined, { numeric: true });
}

/** Sum of the typed litres for one cow row, ignoring blanks and anything that is not a number. */
export function rowTotal(values: (string | null | undefined)[]): number {
  let t = 0;
  for (const v of values) {
    const n = v === null || v === undefined || v.trim() === "" ? 0 : Number(v);
    if (Number.isFinite(n)) t += n;
  }
  return Math.round(t * 100) / 100;
}
