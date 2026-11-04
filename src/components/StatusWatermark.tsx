import { watermarkFor } from "@/lib/animalStatus";

// A stamp across an animal's photo when it is SOLD or DEAD. Put it inside a frame that has `relative` and `overflow-hidden`; it
// covers the frame, ignores clicks (the photo underneath still works) and is drawn over the picture, never into the stored file.
const SIZE = {
  xs: "text-[9px] border px-1 py-0 tracking-wider",
  sm: "text-sm border-2 px-2 py-0.5 tracking-widest",
  lg: "text-6xl border-4 px-5 py-1 tracking-[0.2em]",
} as const;
const TONE = {
  sold: "text-amber-700 border-amber-700 bg-white/60",
  dead: "text-red-700 border-red-700 bg-white/60",
} as const;

export default function StatusWatermark({ status, size = "xs" }: { status: string | null | undefined; size?: keyof typeof SIZE }) {
  const mark = watermarkFor(status);
  if (!mark) return null;
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      <span className={`-rotate-[24deg] select-none rounded font-extrabold uppercase leading-tight shadow-sm ${SIZE[size]} ${TONE[mark.tone]}`}>{mark.text}</span>
    </span>
  );
}
