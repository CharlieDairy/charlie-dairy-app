import { z } from "zod";

// Fill the Daily Record Sheet from a photo of a similar paper sheet. The AI reads the photo into the structure below; this module
// turns that into the sheet's own input names, matching tags, buyers and feeds to the ones on the sheet. Nothing here talks to the
// database or the AI, so it is tested on its own. The result is only ever a draft that a person checks before saving.

const num = z.number().nullable();

export const SheetReadSchema = z.object({
  date: z.string(), // YYYY-MM-DD, or "" when no date can be read
  milk: z.array(z.object({ tag: z.string(), morning: num, noon: num, evening: num })),
  sold: z.array(z.object({ buyer: z.string(), litres: num })),
  used: z.array(z.object({ kind: z.string(), litres: num })),
  feed: z.array(z.object({ name: z.string(), used: num, received: num })),
  note: z.string(),
  unclear: z.array(z.string()),
});
export type SheetRead = z.infer<typeof SheetReadSchema>;

export type SheetContext = {
  cows: { id: string; tag: string }[];
  customers: { id: string; name: string }[];
  feeds: { id: string; name: string }[];
  /** false when the signed-in person cannot record feed: feed figures are then left out */
  canFeed: boolean;
};

export type SheetFill = {
  /** input name -> text to put in the box, e.g. { "m_cow1_M": "5.25" } */
  fills: Record<string, string>;
  /** things read from the photo that match nothing on the sheet, for the person to look at */
  unmatched: string[];
};

const USE_TYPES: { type: string; test: RegExp }[] = [
  { type: "CALF_USE", test: /calf|calves|kid|baby/ },
  { type: "EMPLOYEE_USE", test: /employee|worker|staff|labou?r|servant/ },
  { type: "FARM_USE", test: /farm|house|home|own|tea|use/ },
];

/** lower case letters and digits only, so "Tag # 55", "tag55" and "55" can be compared */
const squash = (s: string) => s.toLowerCase().replace(/\btag\b/g, "").replace(/[^a-z0-9]/g, "");
/** "055" and "55" are the same animal */
const normTag = (s: string) => {
  const t = squash(s);
  return /^\d+$/.test(t) ? String(Number(t)) : t;
};

/** litres as typed into a box: at most 2 decimals, no trailing zeros, never negative */
export function litresText(n: number | null | undefined, max = 200): string | null {
  if (n === null || n === undefined || !Number.isFinite(n) || n < 0 || n > max) return null;
  return String(Math.round(n * 100) / 100);
}

function findByName<T extends { name: string }>(items: T[], read: string): T | null {
  const q = squash(read);
  if (!q) return null;
  const exact = items.filter((i) => squash(i.name) === q);
  if (exact.length === 1) return exact[0];
  const partial = items.filter((i) => squash(i.name).includes(q) || q.includes(squash(i.name)));
  return partial.length === 1 ? partial[0] : null;
}

export function buildSheetFill(read: SheetRead, ctx: SheetContext): SheetFill {
  const fills: Record<string, string> = {};
  const unmatched: string[] = [];

  const cowByTag = new Map<string, string>();
  for (const c of ctx.cows) cowByTag.set(normTag(c.tag), c.id);

  for (const row of read.milk) {
    const id = cowByTag.get(normTag(row.tag));
    if (!id) {
      if (row.tag.trim() !== "") unmatched.push(`Tag ${row.tag.trim()} is not on this sheet`);
      continue;
    }
    for (const [code, v] of [["M", row.morning], ["A", row.noon], ["E", row.evening]] as const) {
      const t = litresText(v);
      if (t !== null) fills[`m_${id}_${code}`] = t;
    }
  }

  const buyers = ctx.customers.map((c) => ({ id: c.id, name: c.name }));
  for (const row of read.sold) {
    const hit = findByName(buyers, row.buyer);
    const t = litresText(row.litres, 100_000);
    if (!hit) {
      if (row.buyer.trim() !== "" && t !== null) unmatched.push(`Buyer "${row.buyer.trim()}" is not on this sheet`);
      continue;
    }
    if (t !== null) fills[`sale_${hit.id}`] = t;
  }

  for (const row of read.used) {
    const kind = row.kind.toLowerCase();
    const hit = USE_TYPES.find((u) => u.test.test(kind));
    const t = litresText(row.litres, 100_000);
    if (!hit) {
      if (row.kind.trim() !== "" && t !== null) unmatched.push(`Milk use "${row.kind.trim()}" is not on this sheet`);
      continue;
    }
    if (t !== null) fills[`use_${hit.type}`] = t;
  }

  if (ctx.canFeed) {
    for (const row of read.feed) {
      const hit = findByName(ctx.feeds, row.name);
      const used = litresText(row.used, 10_000_000);
      const received = litresText(row.received, 10_000_000);
      if (!hit) {
        if (row.name.trim() !== "" && (used !== null || received !== null)) unmatched.push(`Feed "${row.name.trim()}" is not on this sheet`);
        continue;
      }
      // a quantity of zero is the same as nothing written
      if (used !== null && Number(used) > 0) fills[`out_${hit.id}`] = used;
      if (received !== null && Number(received) > 0) fills[`in_${hit.id}`] = received;
    }
  } else if (read.feed.some((f) => f.used !== null || f.received !== null)) {
    unmatched.push("Feed figures were left out because your account cannot record feed");
  }

  const note = read.note.trim();
  if (note) fills.note = note.slice(0, 1000);

  for (const u of read.unclear) if (u.trim() !== "") unmatched.push(`Hard to read: ${u.trim()}`);
  return { fills, unmatched };
}
