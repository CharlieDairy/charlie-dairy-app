// Builds a PDF whose pages are full-page JPEG pictures (A4 portrait). Hand-written so the app needs no PDF library.
// Used to share the Daily Record Sheet as a PDF.

export type JpegPage = { data: Uint8Array; width: number; height: number };

export const PDF_PAGE_W = 595;
export const PDF_PAGE_H = 842;

export function buildPdfFromJpegs(pages: JpegPage[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (u: Uint8Array) => {
    chunks.push(u);
    len += u.length;
  };
  const str = (s: string) => push(enc.encode(s));
  const obj = (n: number, body: () => void) => {
    offsets[n] = len;
    str(`${n} 0 obj\n`);
    body();
    str("endobj\n");
  };

  str("%PDF-1.4\n");
  obj(1, () => str("<< /Type /Catalog /Pages 2 0 R >>\n"));
  obj(2, () => str(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + 3 * i} 0 R`).join(" ")}] >>\n`));
  pages.forEach((p, i) => {
    const page = 3 + 3 * i;
    obj(page, () => str(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_W} ${PDF_PAGE_H}] /Resources << /XObject << /Im0 ${page + 2} 0 R >> >> /Contents ${page + 1} 0 R >>\n`));
    const content = `q ${PDF_PAGE_W} 0 0 ${PDF_PAGE_H} 0 0 cm /Im0 Do Q`;
    obj(page + 1, () => str(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\n`));
    obj(page + 2, () => {
      str(`<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.data.length} >>\nstream\n`);
      push(p.data);
      str("\nendstream\n");
    });
  });
  const count = 3 + 3 * pages.length;
  const xref = len;
  str(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++) str(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  str(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);

  const out = new Uint8Array(len);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
