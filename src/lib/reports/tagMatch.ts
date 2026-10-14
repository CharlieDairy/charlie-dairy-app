// The cash book names animals in free text ("Semen for Tag 56", "Medicine for Tag 50 and Tag 119",
// "Tag 111,114,117 Heifers sale"). This pulls the animal tags out of such a remark so a cost or a sale can be
// attached to the animal it was for. Tags are matched exactly, case-insensitive.

const TAG_TOKEN = "[A-Za-z]{0,3}-?\\d+";
// "tag" or "tags", then a tag, then any number of further tags joined by , & + and / "tag"
const GROUP = new RegExp(`\\btags?\\b[\\s:#.-]*(${TAG_TOKEN}(?:\\s*(?:,|&|\\+|\\band\\b)\\s*(?:tags?\\b[\\s:#.-]*)?${TAG_TOKEN})*)`, "gi");

export function extractTags(remark: string | null | undefined): string[] {
  if (!remark) return [];
  const found = new Set<string>();
  for (const m of remark.matchAll(GROUP)) {
    for (const t of m[1].matchAll(new RegExp(TAG_TOKEN, "g"))) found.add(t[0].toUpperCase());
  }
  return [...found];
}

export function mentionsTag(remark: string | null | undefined, tag: string): boolean {
  return extractTags(remark).includes(tag.trim().toUpperCase());
}

// "Male calf (Tag 137) sale, Mother Tag 47": 137 is what was sold and 47 is its mother, not a second animal sold.
const MOTHER = /\b(?:mother|dam)\b\s*(?:of\s*)?[:#-]?\s*tags?\b[\s:#.-]*([A-Za-z]{0,3}-?\d+)/gi;

export function extractMotherTags(remark: string | null | undefined): string[] {
  if (!remark) return [];
  return [...remark.matchAll(MOTHER)].map((m) => m[1].toUpperCase());
}

/** Tags of the animals that were sold in a sale remark (the mother named in it is left out). */
export function extractSoldTags(remark: string | null | undefined): string[] {
  if (!remark) return [];
  const mothers = new Set(extractMotherTags(remark));
  return extractTags(remark.replace(MOTHER, " ")).filter((t) => !mothers.has(t));
}
