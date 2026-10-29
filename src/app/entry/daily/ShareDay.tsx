"use client";

import { useState } from "react";
import { rowTotal } from "@/lib/dailySheet";
import { buildPdfFromJpegs, PDF_PAGE_H, PDF_PAGE_W, type JpegPage } from "@/lib/pdfImages";
import type { CowRow, CustomerRow, UseRow, FeedRow } from "./DailySheetForm";

// Shares what is saved for the day as a picture (PNG) or a PDF. On a phone the share sheet opens with WhatsApp in it; on a
// computer the file is saved and the person attaches it in WhatsApp Web. The picture is drawn here in the browser from the
// saved figures: nothing is sent to a server.

type Data = { date: string; cows: CowRow[]; customers: CustomerRow[]; usage: UseRow[]; feed: FeedRow[]; note: string; groupTotal: number };

const W = 1080;
const PAD = 40;
const FONT = "'Segoe UI', Arial, sans-serif";
const GREEN = "#14532d";
const INK = "#171717";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";

const n1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString("en-PK", { maximumFractionDigits: 1 });
const blank = (s: string) => s.trim() === "";
const num = (s: string) => {
  const v = Number(s);
  return s.trim() !== "" && Number.isFinite(v) ? v : 0;
};

/** Draws the sheet (when ctx is given) and returns its height, so the canvas can be sized before the real draw. */
function render(ctx: CanvasRenderingContext2D | null, d: Data): number {
  let y = 0;
  const text = (s: string, x: number, yy: number, size: number, color = INK, weight = "400", align: CanvasTextAlign = "left") => {
    if (!ctx) return;
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(s, x, yy);
  };
  const rect = (x: number, yy: number, w: number, h: number, fill: string, stroke?: string) => {
    if (!ctx) return;
    ctx.fillStyle = fill;
    ctx.fillRect(x, yy, w, h);
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, yy + 0.5, w - 1, h - 1);
    }
  };

  // table: first column left, every other column centred
  const table = (x: number, w: number, headers: string[], rows: string[][], widths: number[], bold?: number) => {
    const rowH = 38;
    const cols = widths.map((f) => (f / widths.reduce((a, b) => a + b, 0)) * w);
    const draw = (cells: string[], yy: number, head: boolean, strong: boolean) => {
      rect(x, yy, w, rowH, head ? "#f3f4f6" : "#ffffff", LINE);
      let cx = x;
      cells.forEach((c, i) => {
        if (i === 0) text(c, cx + 12, yy + rowH / 2, head ? 15 : 18, head ? MUTED : INK, head || strong ? "700" : "600");
        else text(c, cx + cols[i] / 2, yy + rowH / 2, head ? 15 : 18, head ? MUTED : INK, head || strong ? "700" : "400", "center");
        cx += cols[i];
      });
    };
    draw(headers, y, true, false);
    y += rowH;
    rows.forEach((r, i) => {
      draw(r, y, false, bold === i);
      y += rowH;
    });
  };
  const heading = (s: string) => {
    y += 26;
    text(s, PAD, y + 14, 22, GREEN, "700");
    y += 40;
  };

  const cowsDone = d.cows.filter((c) => !blank(c.m) || !blank(c.a) || !blank(c.e));
  const produced = cowsDone.reduce((s, c) => s + rowTotal([c.m, c.a, c.e]), 0) + d.groupTotal;
  const soldRows = d.customers.filter((c) => !blank(c.litres));
  const sold = soldRows.reduce((s, c) => s + num(c.litres), 0);
  const useRows = d.usage.filter((u) => !blank(u.litres));
  const used = useRows.reduce((s, u) => s + num(u.litres), 0);
  const feedRows = d.feed.filter((f) => !blank(f.out) || !blank(f.in));

  // header band
  rect(0, 0, W, 120, GREEN);
  text("Charlie Dairy", PAD, 44, 36, "#ffffff", "700");
  text("Daily Record Sheet", PAD, 86, 22, "#bbf7d0");
  const label = new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  text(label, W - PAD, 66, 24, "#ffffff", "600", "right");
  y = 120 + 28;

  // summary boxes
  const gap = 16;
  const bw = (W - 2 * PAD - 3 * gap) / 4;
  const boxes: [string, string, string][] = [
    ["Milk produced", `${n1(produced)} L`, INK],
    ["Milk sold", `${n1(sold)} L`, INK],
    ["Milk used", `${n1(used)} L`, INK],
    ["Not accounted for", `${n1(produced - sold - used)} L`, Math.abs(produced - sold - used) > 0.05 ? "#b91c1c" : INK],
  ];
  boxes.forEach(([k, v, color], i) => {
    const bx = PAD + i * (bw + gap);
    rect(bx, y, bw, 92, "#f9fafb", LINE);
    text(k, bx + bw / 2, y + 26, 15, MUTED, "600", "center");
    text(v, bx + bw / 2, y + 62, 28, color, "700", "center");
  });
  y += 92;

  if (cowsDone.length > 0) {
    heading("Milk by cow (litres)");
    const rows = cowsDone.map((c) => [c.tag, c.m || "-", c.a || "-", c.e || "-", n1(rowTotal([c.m, c.a, c.e]))]);
    const head = ["Tag", "Morning", "Noon", "Evening", "Total"];
    const w5 = [1, 1.2, 1.2, 1.2, 1.2];
    if (rows.length > 14) {
      const half = Math.ceil(rows.length / 2);
      const colW = (W - 2 * PAD - 20) / 2;
      const top = y;
      table(PAD, colW, head, rows.slice(0, half), w5);
      const left = y;
      y = top;
      table(PAD + colW + 20, colW, head, rows.slice(half), w5);
      y = Math.max(y, left);
    } else {
      table(PAD, W - 2 * PAD, head, rows, w5);
    }
    if (d.groupTotal > 0) {
      y += 10;
      text(`Herd / group total recorded without a cow tag: ${n1(d.groupTotal)} L`, PAD, y + 14, 17, MUTED);
      y += 28;
    }
  }

  if (soldRows.length > 0) {
    heading("Milk sold");
    const rows = soldRows.map((c) => [c.name, n1(num(c.litres)), c.rate > 0 ? `Rs ${n1(c.rate)}` : "-", `Rs ${Math.round(num(c.litres) * c.rate).toLocaleString("en-PK")}`]);
    rows.push(["Total", n1(sold), "", `Rs ${Math.round(soldRows.reduce((s, c) => s + num(c.litres) * c.rate, 0)).toLocaleString("en-PK")}`]);
    table(PAD, W - 2 * PAD, ["Buyer", "Litres", "Rate", "Amount"], rows, [2, 1, 1, 1.4], rows.length - 1);
  }

  if (useRows.length > 0) {
    heading("Milk used on the farm");
    table(PAD, W - 2 * PAD, ["Use", "Litres"], useRows.map((u) => [u.label, n1(num(u.litres))]), [3, 1]);
  }

  if (feedRows.length > 0) {
    heading("Feed");
    table(
      PAD,
      W - 2 * PAD,
      ["Feed", "Used", "Received", "Rate paid", "Stock now"],
      feedRows.map((f) => [`${f.name} (${f.unit})`, f.out || "-", f.in || "-", f.inRate ? `Rs ${f.inRate}` : "-", n1(f.stock)]),
      [2, 1, 1, 1, 1]
    );
  }

  if (d.note.trim() !== "") {
    heading("Note for the day");
    const words = d.note.trim().split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (ctx) ctx.font = `400 18px ${FONT}`;
      if (ctx && ctx.measureText(next).width > W - 2 * PAD && cur) {
        lines.push(cur);
        cur = w;
      } else if (!ctx && next.length > 85 && cur) {
        lines.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    lines.forEach((l) => {
      text(l, PAD, y + 12, 18);
      y += 28;
    });
  }

  y += 36;
  text("Shared from Charlie Dairy", W / 2, y, 14, MUTED, "400", "center");
  return y + 30;
}

function drawSheet(d: Data): HTMLCanvasElement {
  const height = render(null, d);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = Math.ceil(height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  render(ctx, d);
  return canvas;
}

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not make the picture"))), type, q));

/** A4 portrait PDF, one picture per page. */
async function buildPdf(canvas: HTMLCanvasElement): Promise<Blob> {
  const sliceH = Math.floor((canvas.width * PDF_PAGE_H) / PDF_PAGE_W);
  const pages: JpegPage[] = [];
  for (let top = 0; top < canvas.height; top += sliceH) {
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceH;
    const sctx = slice.getContext("2d")!;
    sctx.fillStyle = "#ffffff";
    sctx.fillRect(0, 0, slice.width, slice.height);
    const h = Math.min(sliceH, canvas.height - top);
    sctx.drawImage(canvas, 0, top, canvas.width, h, 0, 0, canvas.width, h);
    pages.push({ data: new Uint8Array(await (await toBlob(slice, "image/jpeg", 0.92)).arrayBuffer()), width: slice.width, height: slice.height });
  }
  return new Blob([buildPdfFromJpegs(pages) as BlobPart], { type: "application/pdf" });
}

export default function ShareDay(props: Data) {
  const [busy, setBusy] = useState<"png" | "pdf" | null>(null);
  const [msg, setMsg] = useState("");

  const share = async (kind: "png" | "pdf") => {
    setBusy(kind);
    setMsg("");
    try {
      const canvas = drawSheet(props);
      const blob = kind === "png" ? await toBlob(canvas, "image/png") : await buildPdf(canvas);
      const name = `Charlie-Dairy-Daily-${props.date}.${kind}`;
      const file = new File([blob], name, { type: blob.type });
      const title = `Charlie Dairy daily record ${props.date}`;
      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title, text: title });
          setMsg("Shared.");
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return; // the person closed the share sheet
        }
      }
      // No share sheet (a computer): save the file, then attach it in WhatsApp.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setMsg(`Saved ${name}. Open WhatsApp and attach it to the chat.`);
    } catch {
      setMsg("Could not make the file. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <span className="text-sm font-semibold text-neutral-800">Share this day on WhatsApp</span>
      <button type="button" onClick={() => share("png")} disabled={busy !== null} className="link-btn disabled:opacity-60">
        {busy === "png" ? "Preparing…" : "Share as image"}
      </button>
      <button type="button" onClick={() => share("pdf")} disabled={busy !== null} className="link-btn disabled:opacity-60">
        {busy === "pdf" ? "Preparing…" : "Share as PDF"}
      </button>
      <span className="text-xs text-neutral-500">Shares what is saved for {props.date}. Save the sheet first.</span>
      {msg && <span className="w-full text-sm text-green-700" role="status">{msg}</span>}
    </div>
  );
}
