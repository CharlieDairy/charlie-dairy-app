import Link from "next/link";
import { auth } from "@/auth";
import type { ModuleName } from "@/lib/modules";

const tiles: { href: string; label: string; desc: string; module: ModuleName }[] = [
  { href: "/entry/milking", label: "Milking Entry", desc: "Record litres per cow, per shift", module: "OPERATIONS" },
  { href: "/entry/feed", label: "Feed Entry", desc: "Record feed inward / outward", module: "OPERATIONS" },
  { href: "/entry/milk-sale", label: "Milk Sale Entry", desc: "Record a milk sale", module: "OPERATIONS" },
  { href: "/entry/breeding/heat", label: "Heat Detection", desc: "Record a heat event", module: "OPERATIONS" },
  { href: "/entry/breeding/ai", label: "Insemination / Service", desc: "Record AI, natural service or embryo transfer", module: "OPERATIONS" },
  { href: "/entry/breeding/pregnancy-check", label: "Pregnancy Check", desc: "Record a pregnancy diagnosis", module: "OPERATIONS" },
  { href: "/entry/breeding/calving", label: "Calving", desc: "Record a calving and its calf", module: "OPERATIONS" },
  { href: "/entry/cash", label: "Cash Entry", desc: "Record cash in / cash out", module: "FINANCIAL" },
];

export default async function EntryHome() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const modules = ((session?.user as { modules?: string[] } | undefined)?.modules ?? []) as ModuleName[];
  const isFullAdmin = role === "ADMIN";
  const visible = tiles.filter((t) => isFullAdmin || modules.includes(t.module));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900">What would you like to record?</h1>
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
          <p className="text-sm text-neutral-400">No data entry forms are enabled for your account yet — ask an admin to grant access under Users &amp; Access.</p>
        )}
      </div>
    </div>
  );
}
