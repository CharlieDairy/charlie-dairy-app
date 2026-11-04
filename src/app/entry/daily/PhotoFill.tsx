"use client";

import { useRef, useState } from "react";
import { readSheetFromPhoto } from "./photoActions";

type Applied = { applied: number; locked: number; typed: number };

const MAX_SIDE = 2000;

/** The photo is shrunk in the browser: phone photos are huge, and this also turns it the right way up. */
async function shrink(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This kind of picture cannot be read here. Take the photo again as a normal JPEG picture.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.88));
  if (!blob) throw new Error("The photo could not be prepared. Try another one.");
  return new File([blob], "sheet.jpg", { type: "image/jpeg" });
}

// "Fill from a photo": reads a photo of a paper sheet and puts the figures in the empty boxes as a DRAFT. Nothing is saved until
// the person checks the highlighted boxes and presses Save.
export default function PhotoFill({ date, onApply }: { date: string; onApply: (fills: Record<string, string>) => Applied }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("date", date);
      fd.set("photo", await shrink(file));
      const r = await readSheetFromPhoto(fd);
      if (!r.success || !r.fills) {
        setMsg({ ok: false, text: r.message, extra: r.unmatched ?? [], link: r.photoDate ? `/entry/daily?date=${r.photoDate}` : undefined });
        return;
      }
      const a = onApply(r.fills);
      const parts = [`Filled ${a.applied} box${a.applied === 1 ? "" : "es"} (shown in yellow).`];
      if (a.locked > 0) parts.push(`${a.locked} already saved, so left alone.`);
      if (a.typed > 0) parts.push(`${a.typed} already typed, so left as typed.`);
      parts.push("Check them against the photo, then press Save. Nothing is saved until you do.");
      setMsg({ ok: true, text: parts.join(" "), extra: r.unmatched ?? [] });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Something went wrong reading the photo. Try again.", extra: [] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white border border-neutral-200 rounded-lg p-4 flex flex-col gap-3">
      <div>
        <h2 className="font-semibold text-neutral-900">Fill from a photo</h2>
        <p className="text-sm text-neutral-500">
          Take or choose a photo of a paper sheet like this one. The figures are read and put in the empty boxes as a draft for {date}. Check them, then press Save.
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
        <button type="button" onClick={read} disabled={busy || !preview} className="link-btn link-btn-primary disabled:opacity-60">
          {busy ? "Reading the photo…" : "Read the photo and fill the sheet"}
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
