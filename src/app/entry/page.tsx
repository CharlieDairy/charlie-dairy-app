import Link from "next/link";

const tiles = [
  { href: "/entry/milking", label: "Milking Entry", desc: "Record litres per cow, per shift" },
  { href: "/entry/cash", label: "Cash Entry", desc: "Record cash in / cash out" },
  { href: "/entry/feed", label: "Feed Entry", desc: "Record feed inward / outward" },
  { href: "/entry/milk-sale", label: "Milk Sale Entry", desc: "Record a milk sale" },
];

export default function EntryHome() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900">What would you like to record?</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="block bg-white border border-neutral-200 rounded-lg p-4 shadow-sm active:scale-[0.98] transition"
          >
            <div className="font-medium text-neutral-900">{t.label}</div>
            <div className="text-sm text-neutral-500 mt-1">{t.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
