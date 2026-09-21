import Link from "next/link";
import { auth } from "@/auth";
import { doSignOut } from "@/app/actions/sign-out";
import { MODULES, MODULE_LABELS, type ModuleName } from "@/lib/modules";

const navItems: { href: string; label: string; module: ModuleName | null }[] = [
  { href: "/admin", label: "Dashboard", module: null },
  { href: "/admin/cows", label: "Cow Register", module: "OPERATIONS" },
  { href: "/admin/reports/breeding", label: "Breeding & Reproduction", module: "OPERATIONS" },
  { href: "/admin/reports/herd", label: "Herd Summary", module: "OPERATIONS" },
  { href: "/admin/reports/reconciliation", label: "Production Reconciliation", module: "OPERATIONS" },
  { href: "/admin/assets", label: "Assets", module: "FINANCIAL" },
  { href: "/admin/capital", label: "Capital Ledger", module: "FINANCIAL" },
  { href: "/admin/reports/pl", label: "P&L Statement", module: "FINANCIAL" },
  { href: "/admin/reports/cashflow", label: "Cash Flow", module: "FINANCIAL" },
  { href: "/admin/users", label: "Users & Access", module: "PEOPLE" },
  { href: "/admin/master-data", label: "Master Data", module: "ADMIN" },
  { href: "/admin/bulk", label: "Bulk Data", module: "ADMIN" },
  { href: "/admin/audit-log", label: "Audit Log", module: "ADMIN" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const modules = ((session?.user as { modules?: string[] } | undefined)?.modules ?? []) as ModuleName[];
  const isFullAdmin = role === "ADMIN";

  const canSee = (item: (typeof navItems)[number]) =>
    isFullAdmin || (item.module ? modules.includes(item.module) : modules.length > 0);

  const dashboardItem = navItems.find((i) => i.module === null && canSee(i));
  const groups = MODULES.map((m) => ({
    module: m,
    items: navItems.filter((i) => i.module === m && canSee(i)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 md:flex-row">
      <header className="bg-green-900 text-white p-4 flex flex-col gap-1 md:w-64 md:shrink-0">
        <div className="flex items-center justify-between md:block">
          <Link href="/admin" className="font-semibold text-lg">Charlie Dairy</Link>
          <form action={doSignOut} className="md:mt-4">
            <button type="submit" className="text-sm underline text-green-100">Sign out</button>
          </form>
        </div>
        <nav className="flex flex-col gap-3 mt-3 text-sm">
          {dashboardItem && (
            <Link href={dashboardItem.href} className="text-green-100 hover:text-white hover:underline font-medium">
              {dashboardItem.label}
            </Link>
          )}
          {groups.map((g) => (
            <div key={g.module} className="flex flex-col gap-1">
              <p className="text-xs uppercase tracking-wide text-green-400 font-semibold mt-1">
                {MODULE_LABELS[g.module]}
              </p>
              {g.items.map((item) => (
                <Link key={item.href} href={item.href} className="text-green-100 hover:text-white hover:underline pl-1">
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
          <Link href="/entry" className="text-green-100 hover:text-white hover:underline mt-2 pt-2 border-t border-green-800">
            Data Entry →
          </Link>
        </nav>
      </header>
      <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">{children}</main>
    </div>
  );
}
