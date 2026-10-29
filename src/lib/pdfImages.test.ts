import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPdfFromJpegs } from "./pdfImages";

// not a real picture: the writer only copies the bytes, so any bytes with the JPEG markers will do
const fakeJpeg = (n: number) => Uint8Array.from([0xff, 0xd8, ...Array.from({ length: n }, (_, i) => i % 251), 0xff, 0xd9]);
const latin = (u: Uint8Array) => new TextDecoder("latin1").decode(u);

test("the PDF has a header, a trailer and one page object per picture", () => {
  const pdf = buildPdfFromJpegs([
    { data: fakeJpeg(300), width: 1080, height: 1528 },
    { data: fakeJpeg(500), width: 1080, height: 1528 },
  ]);
  const text = latin(pdf);
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.ok(text.trimEnd().endsWith("%%EOF"));
  assert.match(text, /\/Count 2 /);
  assert.equal((text.match(/\/Type \/Page /g) ?? []).length, 2);
});

test("every cross-reference offset points at its object, and startxref points at the table", () => {
  const pdf = buildPdfFromJpegs([{ data: fakeJpeg(1000), width: 1080, height: 1528 }, { data: fakeJpeg(64), width: 1080, height: 1528 }]);
  const text = latin(pdf);
  const start = Number(/startxref\n(\d+)\n/.exec(text)![1]);
  assert.equal(text.slice(start, start + 4), "xref");
  const entries = [...text.slice(start).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
  assert.equal(entries.length, 8); // catalog, pages, then page + content + image for two pages
  entries.forEach((offset, i) => assert.equal(text.slice(offset).startsWith(`${i + 1} 0 obj`), true, `object ${i + 1}`));
});

test("the picture bytes are copied unchanged and the stream length matches", () => {
  const data = fakeJpeg(777);
  const pdf = buildPdfFromJpegs([{ data, width: 10, height: 10 }]);
  const text = latin(pdf);
  const at = text.indexOf("/Subtype /Image");
  const m = /\/Length (\d+) >>\nstream\n/.exec(text.slice(at))!;
  assert.equal(Number(m[1]), data.length);
  const begin = text.indexOf("stream\n", at) + 7;
  assert.deepEqual(Array.from(pdf.slice(begin, begin + data.length)), Array.from(data));
});
