import { isDemo } from "@/lib/demo";

export default function DemoBanner() {
  if (!isDemo) return null;
  return (
    <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900" role="note">
      DEMO — a made-up farm. Every name, animal and rupee here is invented, and nothing you change affects any real farm.
    </div>
  );
}
