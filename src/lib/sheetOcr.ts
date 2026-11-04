import type { SheetRead } from "@/lib/sheetPhoto";

// Turns the words an OCR engine found in a photo of the Daily Record Sheet (each with its position) into figures: the date, milk per
// tag by session, milk sold, milk used, feed and the note. It works from the printed headings (Tag / Morning / Noon / Evening,
// Buyer / Litres, Feed / Used / Received ...), which the sheet in the app and its shared image both have. Pure, so it is tested
// without an image. A wrong figure is worse than a missing one: a number the engine was not sure of is left out and listed.

export type OcrWord = { text: string; x0: number; y0: number; x1: number; y1: number; conf?: number };

type Line = { words: OcrWord[]; text: string };
type Cols = Partial<Record<"morning" | "noon" | "evening" | "total" | "used" | "received" | "rate" | "stock", number>>;

const MIN_CONF = 50; // below this a number is treated as unreadable
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const xc = (w: OcrWord) => (w.x0 + w.x1) / 2;
const yc = (w: OcrWord) => (w.y0 + w.y1) / 2;
const clean = (s: string) => s.trim();

/** The shape of what the OCR engine returns for a page, as far as this file needs it. */
type OcrBlocks = { paragraphs: { lines: { words: { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }[] }[] }[];

/** Every word the engine found, with its position and how sure it was (0-100). */
export function wordsFromBlocks(blocks: OcrBlocks | null | undefined): OcrWord[] {
  const out: OcrWord[] = [];
  for (const b of blocks ?? []) for (const p of b.paragraphs ?? []) for (const l of p.lines ?? []) for (const w of l.words ?? []) out.push({ text: w.text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1, conf: w.confidence });
  return out;
}

/** Words into lines, top to bottom and left to right inside a line. */
export function groupLines(words: OcrWord[]): Line[] {
  const ws = words.map((w) => ({ ...w, text: clean(w.text) })).filter((w) => w.text !== "");
  if (ws.length === 0) return [];
  const heights = ws.map((w) => w.y1 - w.y0).sort((a, b) => a - b);
  const tol = Math.max(4, heights[Math.floor(heights.length / 2)] * 0.6);
  ws.sort((a, b) => yc(a) - yc(b));
  const groups: { y: number; words: OcrWord[] }[] = [];
  for (const w of ws) {
    const g = groups[groups.length - 1];
    if (g && Math.abs(yc(w) - g.y) <= tol) {
      g.words.push(w);
      g.y = g.words.reduce((s, x) => s + yc(x), 0) / g.words.length;
    } else groups.push({ y: yc(w), words: [w] });
  }
  return groups.map((g) => {
    const sorted = g.words.sort((a, b) => a.x0 - b.x0);
    return { words: sorted, text: sorted.map((w) => w.text).join(" ") };
  });
}

/** A figure as the OCR engine often misreads it: "O" for 0, "l" for 1, a decimal comma. Null when the word is not a number. */
export function ocrNumber(raw: string): number | null {
  if (!/^[0-9OoIl|,.]+$/.test(raw)) return null;
  let s = raw.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1");
  if (!/[0-9]/.test(s)) return null;
  s = s.replace(/^[^\d]+|[^\d]+$/g, "");
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const isDash = (t: string) => /^[-–—_~.]+$/.test(t);
const isRs = (t: string) => /^rs\.?$/i.test(t);

/** A month word to 0-11. One wrong letter is allowed ("Qct" for "Oct"), but only when exactly one month fits. */
function monthIndex(word: string): number {
  const p = word.slice(0, 3).toLowerCase();
  const exact = MONTHS.indexOf(p);
  if (exact >= 0) return exact;
  const close = MONTHS.map((m, i) => ({ i, same: [0, 1, 2].filter((k) => m[k] === p[k]).length })).filter((c) => c.same >= 2);
  return close.length === 1 ? close[0].i : -1;
}

function parseDate(lines: Line[]): string {
  for (const l of lines) {
    const t = l.text;
    let m = /(\d{4})-(\d{2})-(\d{2})/.exec(t);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = /(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4}|\d{2})\b/.exec(t);
    if (m) {
      const y = m[3].length === 2 ? `20${m[3]}` : m[3];
      const month = Number(m[2]);
      const day = Number(m[1]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    m = /(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/.exec(t);
    if (m) {
      const mi = monthIndex(m[2]);
      if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
    }
  }
  return "";
}

function headerCols(line: Line): Cols {
  const cols: Cols = {};
  for (const w of line.words) {
    const t = w.text.toLowerCase();
    if (/^morn/.test(t)) cols.morning = xc(w);
    else if (/^(noon|afternoon)/.test(t)) cols.noon = xc(w);
    else if (/^even/.test(t)) cols.evening = xc(w);
    else if (/^total/.test(t)) cols.total = xc(w);
    else if (/^used/.test(t)) cols.used = xc(w);
    else if (/^receiv/.test(t)) cols.received = xc(w);
    else if (/^rate/.test(t)) cols.rate = xc(w);
    else if (/^stock/.test(t)) cols.stock = xc(w);
  }
  return cols;
}

/** The column whose heading is nearest to this word. */
function nearest(cols: Cols, w: OcrWord): keyof Cols | null {
  let best: keyof Cols | null = null;
  let d = Infinity;
  for (const [k, x] of Object.entries(cols) as [keyof Cols, number][]) {
    const dist = Math.abs(xc(w) - x);
    if (dist < d) {
      d = dist;
      best = k;
    }
  }
  return best;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** No cow gives more than this at one milking; a bigger figure is nearly always a lost decimal point ("5.5" read as "55"). */
const MAX_SESSION = 40;
const SESSIONS = ["morning", "noon", "evening"] as const;

/**
 * The OCR engine sometimes loses a decimal point. The row's own Total is a second reading of the same figures, so it can settle it:
 * a figure is corrected only when dividing exactly ONE figure by 10 or 100 makes the row add up to its total. Anything still
 * doubtful is listed for the person to check, and an impossible figure is left empty.
 */
export function checkMilkRow(
  row: { morning: number | null; noon: number | null; evening: number | null },
  total: number | null,
  label: string,
  unclear: (s: string) => void
): void {
  const sum = () => round2(SESSIONS.reduce((s, k) => s + (row[k] ?? 0), 0));
  if (total !== null && Math.abs(sum() - total) > 0.05) {
    const fixes: { k: (typeof SESSIONS)[number]; to: number }[] = [];
    for (const k of SESSIONS) {
      const v = row[k];
      if (v === null) continue;
      for (const d of [10, 100]) {
        const to = round2(v / d);
        if (Math.abs(sum() - v + to - total) <= 0.05) fixes.push({ k, to });
      }
    }
    const distinct = new Set(fixes.map((f) => f.k));
    if (distinct.size === 1) {
      const f = fixes[0];
      unclear(`${label} ${f.k}: read as ${row[f.k]} but its total says ${f.to}, so it was set to ${f.to}. Check it`);
      row[f.k] = f.to;
    } else if (SESSIONS.some((k) => row[k] === null) && sum() < total - 0.05) {
      unclear(`${label}: its total is higher than the figures read, so a figure may be missing. Check it`);
    } else {
      unclear(`${label}: the figures do not add up to its total, check them`);
    }
  }
  for (const k of SESSIONS) {
    const v = row[k];
    if (v !== null && v > MAX_SESSION) {
      unclear(`${label} ${k}: ${v} looks too high for one milking, check the decimal point`);
      row[k] = null;
    }
  }
}

export function parseOcrSheet(words: OcrWord[]): SheetRead {
  const lines = groupLines(words);
  const out: SheetRead = { date: "", milk: [], sold: [], used: [], feed: [], note: "", unclear: [] };
  const unclear = (s: string) => {
    if (!out.unclear.includes(s)) out.unclear.push(s);
  };

  // the date is written near the top
  out.date = parseDate(lines.slice(0, 14)) || parseDate(lines);

  let state: "top" | "milk" | "sold" | "used" | "feed" | "note" = "top";
  let milkCols: Cols = {};
  let feedCols: Cols = {};
  const noteParts: string[] = [];

  // a figure the engine was not sure of is dropped, and listed
  const figure = (w: OcrWord, label: string): number | null => {
    const n = ocrNumber(w.text);
    if (n === null) return null;
    if (w.conf !== undefined && w.conf < MIN_CONF) {
      unclear(`${label}: could not read the digits`);
      return null;
    }
    return n;
  };

  for (const line of lines) {
    const low = line.text.toLowerCase();

    // section headings
    if (/milk by cow/.test(low)) { state = "milk"; continue; }
    if (/\btag\b/.test(low) && /(morning|noon|evening)/.test(low)) { state = "milk"; milkCols = headerCols(line); continue; }
    if (/milk sold|^buyer\b/.test(low)) { state = "sold"; continue; }
    if (/milk used|^use\s+litres/.test(low)) { state = "used"; continue; }
    if (/^feed\b/.test(low) && /(used|received)/.test(low)) { state = "feed"; feedCols = headerCols(line); continue; }
    if (/^feed\s*$/.test(low)) { state = "feed"; continue; }
    if (/^note|note for the day/.test(low)) { state = "note"; continue; }
    if (/^(production|total)\b|shared from|herd \/ group/.test(low)) continue;
    if (state === "feed" && /received/.test(low) && Object.keys(headerCols(line)).length >= 2) { feedCols = headerCols(line); continue; }

    const words = line.words;
    const firstNum = words.findIndex((w, i) => i > 0 && ocrNumber(w.text) !== null);

    if (state === "milk") {
      let tagIdx = 0;
      if (/^tag$/i.test(words[0].text) && words.length > 1) tagIdx = 1;
      const tag = words[tagIdx].text.replace(/^#/, "").replace(/[^A-Za-z0-9]/g, "");
      if (!tag) continue;
      const nums = words.slice(tagIdx + 1).filter((w) => ocrNumber(w.text) !== null);
      if (nums.length === 0) continue; // a row with nothing written
      const row = { tag, morning: null as number | null, noon: null as number | null, evening: null as number | null };
      const label = `Tag ${tag}`;
      const known = (["morning", "noon", "evening"] as const).filter((k) => milkCols[k] !== undefined);
      let total: number | null = null;
      if (known.length >= 2) {
        const seen = new Set<string>();
        for (const w of nums) {
          const col = nearest(milkCols, w);
          if (!col) continue;
          const n = figure(w, `${label} ${col}`);
          if (col === "total") total = n;
          else if (col === "morning" || col === "noon" || col === "evening") {
            if (seen.has(col)) {
              unclear(`${label} ${col}: two figures under one column`);
              row[col] = null;
              continue;
            }
            seen.add(col);
            row[col] = n;
          }
        }
      } else {
        // no readable column headings: only trust a plain row of three (or three plus the total)
        const vals = nums.map((w) => figure(w, label));
        if (vals.length === 3 || vals.length === 4) {
          row.morning = vals[0];
          row.noon = vals[1];
          row.evening = vals[2];
          if (vals.length === 4) total = vals[3];
        } else unclear(`${label}: could not tell which column each figure is in`);
      }
      checkMilkRow(row, total, label, unclear);
      out.milk.push(row);
      continue;
    }

    if (state === "sold" || state === "used") {
      if (firstNum < 0) continue;
      const name = words
        .slice(0, firstNum)
        .filter((w) => !isRs(w.text))
        .map((w) => w.text)
        .join(" ");
      if (!name) continue;
      const n = figure(words[firstNum], name);
      if (state === "sold") out.sold.push({ buyer: name, litres: n });
      else out.used.push({ kind: name, litres: n });
      continue;
    }

    if (state === "feed") {
      const cut = words.findIndex((w, i) => i > 0 && (ocrNumber(w.text) !== null || isDash(w.text)));
      if (cut < 0) continue;
      const name = words.slice(0, cut).map((w) => w.text).join(" ");
      const nums = words.slice(cut).filter((w) => ocrNumber(w.text) !== null);
      if (nums.length === 0) continue;
      if (feedCols.used === undefined && feedCols.received === undefined) {
        unclear(`${name}: could not find the Used and Received columns`);
        continue;
      }
      const item = { name, used: null as number | null, received: null as number | null };
      for (const w of nums) {
        const col = nearest(feedCols, w);
        if (col === "used") item.used = figure(w, `${name} used`);
        else if (col === "received") item.received = figure(w, `${name} received`);
      }
      out.feed.push(item);
      continue;
    }

    if (state === "note") noteParts.push(line.text);
  }

  out.note = noteParts.join(" ").replace(/\s+/g, " ").trim();
  return out;
}
