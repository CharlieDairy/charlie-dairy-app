// Copies the in-browser OCR engine (tesseract.js) and its English language data from node_modules into public/ocr, so reading a
// photo of the Daily Record Sheet runs on the person's own phone or computer with nothing fetched from anywhere else.
// Runs after every install (see "postinstall" in package.json). public/ocr is generated, so it is not committed.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, "public", "ocr");
const nm = (...p) => path.join(root, "node_modules", ...p);

const files = [
  [nm("tesseract.js", "dist", "worker.min.js"), "worker.min.js"],
  [nm("tesseract.js-core", "tesseract-core-lstm.wasm.js"), "tesseract-core-lstm.wasm.js"],
  [nm("tesseract.js-core", "tesseract-core-simd-lstm.wasm.js"), "tesseract-core-simd-lstm.wasm.js"],
  [nm("tesseract.js-core", "tesseract-core-relaxedsimd-lstm.wasm.js"), "tesseract-core-relaxedsimd-lstm.wasm.js"],
  [nm("@tesseract.js-data", "eng", "4.0.0_best_int", "eng.traineddata.gz"), "eng.traineddata.gz"],
];

try {
  fs.mkdirSync(out, { recursive: true });
  for (const [from, name] of files) fs.copyFileSync(from, path.join(out, name));
  console.log(`OCR files copied to public/ocr (${files.length} files)`);
} catch (e) {
  // Never stop an install: without these files only "Fill from a photo" is unavailable, the rest of the app is unaffected.
  console.warn(`OCR files not copied: ${e.message}`);
}
