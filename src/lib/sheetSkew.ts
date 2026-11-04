// How much a photographed page is tilted, so it can be straightened before it is read. A quick phone photo is rarely level, and a tilt
// of only 2 degrees moves the far end of a row by about 100 pixels, which breaks the rows into pieces.
//
// Method: lines of text are dark pixels lying along a line. Try each small angle, project the dark pixels onto the vertical axis as if
// the page were turned by that angle, and keep the angle where the rows pile up most sharply (the page is then level).
// Pure and fast (a few thousand sampled pixels), so it runs on a small copy of the photo and is tested with a drawn page.

/**
 * `gray`: one byte per pixel, row by row (0 = black, 255 = white). Returns the tilt in degrees, positive when the text runs downhill
 * to the right (the page is turned clockwise). To straighten the photo, turn it by the opposite amount.
 */
export function estimateSkewDegrees(gray: ArrayLike<number>, width: number, height: number, maxDegrees = 6): number {
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  const dark = (sum / gray.length) * 0.75;

  // a sample of the dark pixels: ink only, at most about 40,000 of them
  const total = gray.length;
  const step = Math.max(1, Math.floor(total / 400_000));
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < total; i += step) {
    if (gray[i] < dark) {
      xs.push(i % width);
      ys.push(Math.floor(i / width));
    }
  }
  if (xs.length < 200) return 0;

  const bins = Math.ceil(Math.hypot(width, height)) * 2 + 4;
  const offset = bins / 2;
  const hist = new Float64Array(bins);

  const score = (deg: number) => {
    const t = Math.tan((deg * Math.PI) / 180);
    hist.fill(0);
    for (let i = 0; i < xs.length; i++) hist[Math.round(ys[i] - xs[i] * t + offset)]++;
    let s = 0;
    for (let b = 0; b < bins; b++) s += hist[b] * hist[b];
    return s;
  };

  let best = 0;
  let bestScore = -1;
  for (let d = -maxDegrees; d <= maxDegrees + 1e-9; d += 0.25) {
    const s = score(d);
    if (s > bestScore) {
      bestScore = s;
      best = d;
    }
  }
  for (let d = best - 0.25; d <= best + 0.25 + 1e-9; d += 0.05) {
    const s = score(d);
    if (s > bestScore) {
      bestScore = s;
      best = d;
    }
  }
  return Math.round(best * 100) / 100;
}
