import Link from "next/link";
import { doSignOut } from "@/app/actions/sign-out";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/cows", label: "Cow Register" },
  { href: "/admin/assets", label: "Assets" },
  { href: "/admin/capital", label: "Capital Ledger" },
  { href: "/admin/reports/pl", label: "P&L Statement" },
  { href: "/admin/reports/cashflow", label: "Cash Flow" },
  { href: "/admin/reports/herd", label: "Herd Summary" },
  { href: "/admin/reports/breeding", label: "Breeding & Reproduction" },
  { href: "/admin/reports/reconciliation", label: "Production Reconciliation" },
  { href: "/admin/users", label: "Users & Access" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 md:flex-row">
      <header className="bg-green-900 text-white p-4 flex flex-col gap-1 md:w-64 md:shrink-0">
        <div className="flex items-center justify-between md:block">
          <Link href="/admin" className="font-semibold text-lg">Charlie Dairy</Link>
          <form action={doSignOut} className="md:mt-4">
            <button type="submit" className="text-sm underline text-green-100">Sign out</button>
          </form>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm md:flex-col md:gap-y-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="text-green-100 hover:text-white hover:underline">
              {item.label}
            </Link>
          ))}
          <Link href="/entry" className="text-green-100 hover:text-white hover:underline">Data Entry →</Link>
        </nav>
      </header>
      <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">{children}</main>
    </div>
  );
}
