"use client";

import { useRef, useState } from "react";
import { parseOcrSheet, wordsFromBlocks } from "@/lib/sheetOcr";
import { buildSheetFill, type SheetContext } from "@/lib/sheetPhoto";
import { estimateSkewDegrees } from "@/lib/sheetSkew";

type Applied = { applied: number; locked: number; typed: number };

// The reader loses decimal points in small print ("5.5" comes out as "55"), so the picture is brought to a fixed large size: a small
// picture, such as a sheet shared from this app, is enlarged up to 3 times and a very large phone photo is reduced to match.
const TARGET_SIDE = 3000;
const MAX_ENLARGE = 3;

/** The photo is turned the right way up, brought to a good size and made grey with more contrast, which is what the reader likes best. */
async function prepare(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This kind of picture cannot be read here. Take the photo again as a normal JPEG picture.");
  }
  const scale = Math.min(MAX_ENLARGE, TARGET_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  // A quick phone photo is rarely level, and even 2 degrees breaks the rows apart. Measure the tilt on a small copy.
  const small = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
  const sw = Math.max(1, Math.round(bitmap.width * small));
  const sh = Math.max(1, Math.round(bitmap.height * small));
  const sc = document.createElement("canvas");
  sc.width = sw;
  sc.height = sh;
  const sctx = sc.getContext("2d", { willReadFrequently: true })!;
  sctx.drawImage(bitmap, 0, 0, sw, sh);
  const px = sctx.getImageData(0, 0, sw, sh).data;
  const gray = new Uint8Array(sw * sh);
  for (let i = 0; i < gray.length; i++) gray[i] = px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114;
  const tilt = estimateSkewDegrees(gray, sw, sh);

  // turn it back by that amount, on a white page big enough to hold the turned picture
  const turn = Math.abs(tilt) >= 0.3 ? (-tilt * Math.PI) / 180 : 0;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(Math.abs(w * Math.cos(turn)) + Math.abs(h * Math.sin(turn)));
  canvas.height = Math.ceil(Math.abs(w * Math.sin(turn)) + Math.abs(h * Math.cos(turn)));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.filter = "grayscale(1) contrast(1.35)"; // ignored by browsers that do not support it
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(turn);
  ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) throw new Error("The photo could not be prepared. Try another one.");
  return blob;
}

// "Fill from a photo": reads a photo of a paper sheet ON THIS DEVICE (no account, no key, nothing is sent anywhere) and puts the
// figures in the empty boxes as a DRAFT. Nothing is saved until the person checks the highlighted boxes and presses Save.
export default function PhotoFill({ date, ctx, onApply }: { date: string; ctx: SheetContext; onApply: (fills: Record<string, string>) => Applied }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; extra: string[]; link?: string } | null>(null);

  const choose = (file: File | undefined) => {
    setMsg(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return file ? URL.createObjectURL(file) : null;
    });
  };

  const read = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMsg({ ok: false, text: "Choose or take a photo of the sheet first.", extra: [] });
      return;
    }
    setBusy("Getting the photo ready…");
    setMsg(null);
    let worker: { terminate: () => Promise<unknown> } | null = null;
    try {
      const image = await prepare(file);
      setBusy("Starting the reader (the first time takes a little longer)…");
      const { createWorker } = await import("tesseract.js");
      const w = await createWorker("eng", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr/",
        langPath: "/ocr/",
        workerBlobURL: false,
        logger: (m) => {
          if (m.status === "recognizing text") setBusy(`Reading the photo… ${Math.round((m.progress ?? 0) * 100)}%`);
        },
      });
      worker = w;
      await w.setParameters({ preserve_interword_spaces: "1" });
      const { data } = await w.recognize(image, {}, { blocks: true });
      const read = parseOcrSheet(wordsFromBlocks(data.blocks));
      const sheetDate = date;
      if (/^\d{4}-\d{2}-\d{2}$/.test(read.date) && read.date !== sheetDate) {
        setMsg({
          ok: false,
          text: `The photo is dated ${read.date}, but this sheet is for ${sheetDate}. Nothing was filled. Open ${read.date} and read the photo there.`,
          extra: [],
          link: `/entry/daily?date=${read.date}`,
        });
        return;
      }
      const filled = buildSheetFill(read, ctx);
      const count = Object.keys(filled.fills).length;
      if (count === 0) {
        setMsg({ ok: false, text: "No figures could be read from that photo. Take it again, flat and in good light, with the whole sheet in view.", extra: filled.unmatched });
        return;
      }
      const a = onApply(filled.fills);
      const parts = [`Filled ${a.applied} box${a.applied === 1 ? "" : "es"} (shown in yellow).`];
      if (!read.date) parts.push("No date could be read on the photo, so check it is the right day.");
      if (a.locked > 0) parts.push(`${a.locked} already saved, so left alone.`);
      if (a.typed > 0) parts.push(`${a.typed} already typed, so left as typed.`);
      parts.push("Check every figure against the photo, then press Save. Nothing is saved until you do.");
      setMsg({ ok: true, text: parts.join(" "), extra: filled.unmatched });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Something went wrong reading the photo. Try again.", extra: [] });
    } finally {
      await worker?.terminate().catch(() => undefined);
      setBusy(null);
    }
  };

  return (
    <section className="bg-white border border-neutral-200 rounded-lg p-4 flex flex-col gap-3">
      <div>
        <h2 className="font-semibold text-neutral-900">Fill from a photo</h2>
        <p className="text-sm text-neutral-500">
          Take or choose a photo of a paper sheet like this one, or of a sheet shared from this app. The figures are read on this device (the photo is not sent
          anywhere) and put in the empty boxes as a draft for {date}. Printed figures read best; handwriting may leave boxes empty. Check them, then press Save.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={(e) => choose(e.target.files?.[0])}
          aria-label="Photo of the paper sheet"
          className="text-sm file:mr-3 file:rounded-lg file:border file:border-neutral-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-neutral-50"
        />
        <button type="button" onClick={read} disabled={busy !== null || !preview} className="link-btn link-btn-primary disabled:opacity-60">
          {busy ?? "Read the photo and fill the sheet"}
        </button>
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="The chosen sheet" className="h-16 w-16 rounded-md border border-neutral-200 object-cover" />
        )}
      </div>
      {msg && (
        <div className={`text-sm rounded-md border px-3 py-2 ${msg.ok ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-800"}`} role="status">
          <p>{msg.text}</p>
          {msg.link && (
            <p className="mt-1">
              <a href={msg.link} className="underline font-medium">Open that day</a>
            </p>
          )}
          {msg.extra.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-neutral-700">
              {msg.extra.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
