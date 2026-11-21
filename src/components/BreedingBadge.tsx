import Badge from "@/components/Badge";

// The breeding tag on an animal ("Inseminated", "Pregnancy check due" ...), drawn with the app's shared Badge so colour and
// the colour-blind symbol stay consistent. The detail line is the tooltip, so the farm manager can hover or long-press to
// see how many days and what happens next; `withDetail` prints it under the tag.
const BADGE_TONE = {
  green: "success",
  sky: "info",
  violet: "info",
  amber: "warning",
  orange: "warning",
  rose: "warning",
  red: "danger",
  neutral: "neutral",
} as const;

export type BreedingBadgeData = { code: string; label: string; tone: string; detail: string };

export default function BreedingBadge({ tag, withDetail = false }: { tag: BreedingBadgeData | null | undefined; withDetail?: boolean }) {
  if (!tag) return null;
  const tone = BADGE_TONE[tag.tone as keyof typeof BADGE_TONE] ?? "neutral";
  return (
    <span className="inline-flex flex-col items-start gap-0.5" title={tag.detail}>
      <Badge tone={tone}>{tag.label}</Badge>
      {withDetail && <span className="text-xs text-neutral-500">{tag.detail}</span>}
    </span>
  );
}
