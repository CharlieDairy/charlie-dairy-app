import { test } from "node:test";
import assert from "node:assert/strict";
import { checkMilkRow, groupLines, ocrNumber, parseOcrSheet, wordsFromBlocks, type OcrWord } from "./sheetOcr";

// A word placed on a grid: centred on x, on row y (rows are 40 apart), as an OCR engine would report it.
const w = (text: string, x: number, row: number, conf = 90): OcrWord => ({ text, x0: x - text.length * 6, x1: x + text.length * 6, y0: row * 40, y1: row * 40 + 20, conf });
const line = (row: number, ...cells: [string, number][]) => cells.map(([t, x]) => w(t, x, row));

// the sheet as the app shares it: headings, then rows, with an empty noon box for Tag 7
const COLS = { m: 330, n: 500, e: 670, t: 860 };
const sheet: OcrWord[] = [
  ...line(0, ["Thursday", 700], ["29", 780], ["October", 850], ["2026", 920]),
  ...line(2, ["Milk", 60], ["by", 100], ["cow", 130], ["(litres)", 180]),
  ...line(3, ["Tag", 50], ["Morning", COLS.m], ["Noon", COLS.n], ["Evening", COLS.e], ["Total", COLS.t]),
  ...line(4, ["55", 50], ["5.25", COLS.m], ["4.5", COLS.n], ["5", COLS.e], ["14.75", COLS.t]),
  ...line(5, ["7", 50], ["3", COLS.m], ["4.25", COLS.e], ["7.25", COLS.t]),
  ...line(6, ["Production", 60], ["22", COLS.t]),
  ...line(8, ["Milk", 60], ["sold", 100]),
  ...line(9, ["Buyer", 50], ["Litres", 400], ["Rate", 600], ["Amount", 820]),
  ...line(10, ["City", 50], ["Sale", 100], ["120", 400], ["Rs", 590], ["55", 620], ["Rs", 800], ["6,600", 850]),
  ...line(12, ["Milk", 60], ["used", 100], ["on", 140], ["the", 170], ["farm", 200]),
  ...line(13, ["Use", 50], ["Litres", 400]),
  ...line(14, ["Calf", 50], ["use", 90], ["12", 400]),
  ...line(16, ["Feed", 50]),
  ...line(17, ["Feed", 50], ["Used", 400], ["Received", 540], ["Rate", 690], ["paid", 730], ["Stock", 840], ["now", 880]),
  ...line(18, ["Wenda", 50], ["(bag)", 110], ["2.5", 400], ["20", 540], ["4200", 690], ["27.5", 840]),
  ...line(19, ["Silage", 50], ["(kg)", 110], ["350", 400], ["-", 540], ["55,350", 840]),
  ...line(21, ["Note", 50], ["for", 90], ["the", 120], ["day", 150]),
  ...line(22, ["AI", 50], ["of", 80], ["Tag", 110], ["55", 150]),
];

test("words on the same row are one line, left to right", () => {
  const lines = groupLines([w("b", 200, 3), w("a", 100, 3), w("c", 100, 5)]);
  assert.deepEqual(lines.map((l) => l.text), ["a b", "c"]);
});

test("figures as an OCR engine misreads them", () => {
  assert.equal(ocrNumber("5.25"), 5.25);
  assert.equal(ocrNumber("l2"), 12); // a lowercase L for a one
  assert.equal(ocrNumber("1O"), 10); // a letter O for a zero
  assert.equal(ocrNumber("6,600"), 6600); // thousands comma
  assert.equal(ocrNumber("5,25"), 5.25); // decimal comma
  for (const bad of ["Rs", "-", ".", "abc", "A12", ""]) assert.equal(ocrNumber(bad), null, bad);
});

test("a whole sheet is read by its headings and column positions", () => {
  const r = parseOcrSheet(sheet);
  assert.equal(r.date, "2026-10-29");
  assert.deepEqual(r.milk, [
    { tag: "55", morning: 5.25, noon: 4.5, evening: 5 },
    { tag: "7", morning: 3, noon: null, evening: 4.25 }, // the empty noon box stays empty
  ]);
  assert.deepEqual(r.sold, [{ buyer: "City Sale", litres: 120 }]);
  assert.deepEqual(r.used, [{ kind: "Calf use", litres: 12 }]);
  assert.deepEqual(r.feed, [
    { name: "Wenda (bag)", used: 2.5, received: 20 },
    { name: "Silage (kg)", used: 350, received: null },
  ]);
  assert.equal(r.note, "AI of Tag 55");
  assert.deepEqual(r.unclear, []);
});

test("the date is found in the usual ways it is written", () => {
  const d = (text: string) => parseOcrSheet(text.split(" ").map((t, i) => w(t, 100 + i * 80, 0))).date;
  assert.equal(d("29/10/2026"), "2026-10-29");
  assert.equal(d("29-10-26"), "2026-10-29");
  assert.equal(d("2026-10-29"), "2026-10-29");
  assert.equal(d("29 Oct 2026"), "2026-10-29");
  assert.equal(d("29 Qctober 2026"), "2026-10-29"); // one letter misread
  assert.equal(d("nothing here"), "");
});

test("a lost decimal point is put back when the row's own total proves it", () => {
  const row = { morning: 6 as number | null, noon: 55 as number | null, evening: 5.75 as number | null };
  const notes: string[] = [];
  checkMilkRow(row, 17.25, "Tag 12", (s) => notes.push(s));
  assert.equal(row.noon, 5.5);
  assert.match(notes[0], /read as 55 but its total says 5.5/);
});

test("it does not guess when the total cannot settle which figure is wrong", () => {
  const row = { morning: 10 as number | null, noon: 20 as number | null, evening: 30 as number | null };
  const notes: string[] = [];
  checkMilkRow(row, 7, "Tag 5", (s) => notes.push(s));
  assert.equal(row.morning, 10);
  assert.equal(row.noon, 20);
  assert.equal(row.evening, 30); // none of them is changed, the row is only flagged
  assert.match(notes[0], /do not add up/);
});

test("a figure too high for one milking is left empty, and a missing figure is flagged", () => {
  const high = { morning: 55 as number | null, noon: null, evening: null };
  const notes: string[] = [];
  checkMilkRow(high, null, "Tag 9", (s) => notes.push(s));
  assert.equal(high.morning, null);
  assert.match(notes[0], /looks too high/);

  const missing = { morning: 5 as number | null, noon: null as number | null, evening: 4 as number | null };
  const n2: string[] = [];
  checkMilkRow(missing, 12, "Tag 3", (s) => n2.push(s));
  assert.match(n2[0], /a figure may be missing/);
});

test("a row that adds up to its total raises nothing", () => {
  const row = { morning: 5.25 as number | null, noon: 4.5 as number | null, evening: 5 as number | null };
  const notes: string[] = [];
  checkMilkRow(row, 14.75, "Tag 55", (s) => notes.push(s));
  assert.deepEqual(notes, []);
});

test("a figure the engine was not sure of is left empty instead of guessed", () => {
  const unsure = sheet.map((x) => (x.text === "5.25" ? { ...x, conf: 30 } : x));
  const r = parseOcrSheet(unsure);
  assert.equal(r.milk[0].morning, null);
  assert.ok(r.unclear.some((u) => /Tag 55 morning: could not read the digits/.test(u)));
});

test("without column headings only a plain row of three figures is trusted", () => {
  const r = parseOcrSheet([...line(0, ["Tag", 50]), ...line(1, ["Milk", 50], ["by", 90], ["cow", 120]), ...line(2, ["55", 50], ["5", 200], ["4", 300], ["3", 400]), ...line(3, ["7", 50], ["5", 200], ["4", 300])]);
  assert.deepEqual(r.milk[0], { tag: "55", morning: 5, noon: 4, evening: 3 });
  assert.ok(r.unclear.some((u) => /Tag 7: could not tell which column/.test(u)));
});

test("the engine's blocks are flattened to words with their position and confidence", () => {
  const words = wordsFromBlocks([{ paragraphs: [{ lines: [{ words: [{ text: "55", confidence: 91, bbox: { x0: 1, y0: 2, x1: 3, y1: 4 } }] }] }] }]);
  assert.deepEqual(words, [{ text: "55", x0: 1, y0: 2, x1: 3, y1: 4, conf: 91 }]);
  assert.deepEqual(wordsFromBlocks(null), []);
});
