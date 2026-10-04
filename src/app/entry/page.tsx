import Link from "next/link";
import { getLiveUser, hasPermission } from "@/lib/access";
import type { PermissionModuleKey } from "@/lib/permissions";

const tiles: { href: string; label: string; desc: string; module: PermissionModuleKey }[] = [
  { href: "/entry/milking", label: "Milking Entry", desc: "Record litres per cow, per shift", module: "milk" },
  { href: "/entry/feed", label: "Feed Entry", desc: "Record feed inward / outward", module: "feed" },
  { href: "/entry/milk-sale", label: "Milk Sale Entry", desc: "Record a milk sale", module: "milk" },
  { href: "/entry/breeding/reproduction", label: "Reproduction Entry", desc: "Heat, insemination and pregnancy check", module: "breeding" },
  { href: "/entry/breeding/calving", label: "Calving", desc: "Record a calving and its calf", module: "breeding" },
  { href: "/entry/cash", label: "Cash Entry", desc: "Record cash in / cash out", module: "financial" },
];

export default async function EntryHome() {
  const user = await getLiveUser();
  if (!user) return null; // the layout already renders AccountBlocked in this case
  const visible = tiles.filter((t) => hasPermission(user, t.module, "CREATE"));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">What would you like to record?</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visible.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="block bg-white border border-neutral-200 rounded-lg p-4 shadow-sm active:scale-[0.98] transition"
          >
            <div className="font-medium text-neutral-900">{t.label}</div>
            <div className="text-sm text-neutral-500 mt-1">{t.desc}</div>
          </Link>
        ))}
        {visible.length === 0 && (
          <p className="text-sm text-neutral-400">Your account is View Only, so there are no data entry forms for it.</p>
        )}
      </div>
    </div>
  );
}
