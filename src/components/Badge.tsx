import type { ReactNode } from "react";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

// Never rely on color alone (Part 56) — each tone also gets a distinct
// symbol so the status reads correctly for color-blind users too.
const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-primary-light text-primary-dark",
  warning: "bg-warning-light text-warning",
  danger: "bg-danger-light text-danger",
  info: "bg-info-light text-info",
  neutral: "bg-neutral-100 text-text-muted",
};

const TONE_SYMBOLS: Record<Tone, string> = {
  success: "●",
  warning: "▲",
  danger: "✕",
  info: "ℹ",
  neutral: "○",
};

export default function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}>
      <span aria-hidden="true" className="text-[0.65rem]">{TONE_SYMBOLS[tone]}</span>
      {children}
    </span>
  );
}
