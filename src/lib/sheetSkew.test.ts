import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateSkewDegrees } from "./sheetSkew";

// A white page with rows of dark dashes (like words in a row), the whole page turned by `deg` clockwise.
function page(deg: number, width = 600, height = 400) {
  const gray = new Uint8Array(width * height).fill(255);
  const t = Math.tan((deg * Math.PI) / 180);
  for (let row = 0; row < 8; row++) {
    const y0 = 50 + row * 40;
    for (let x = 30; x < width - 30; x += 14) {
      for (let dx = 0; dx < 9; dx++) {
        const y = Math.round(y0 + (x + dx - width / 2) * t);
        for (let dy = 0; dy < 5; dy++) {
          const yy = y + dy;
          if (yy >= 0 && yy < height) gray[yy * width + x + dx] = 0;
        }
      }
    }
  }
  return { gray, width, height };
}

test("a level page has no tilt", () => {
  const p = page(0);
  assert.ok(Math.abs(estimateSkewDegrees(p.gray, p.width, p.height)) <= 0.25);
});

test("a page turned clockwise reads as a positive tilt, anticlockwise as negative", () => {
  for (const deg of [2, 3.5, -2, -4]) {
    const p = page(deg);
    const got = estimateSkewDegrees(p.gray, p.width, p.height);
    assert.ok(Math.abs(got - deg) <= 0.35, `expected about ${deg}, got ${got}`);
  }
});

test("a blank or almost blank photo is left alone", () => {
  const blank = new Uint8Array(200 * 200).fill(255);
  assert.equal(estimateSkewDegrees(blank, 200, 200), 0);
});
