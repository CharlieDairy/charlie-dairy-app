import Link from "next/link";
import Image from "next/image";
import { doSignOut } from "@/app/actions/sign-out";
import { visibleSections } from "@/lib/nav";
import type { ModuleName } from "@/lib/modules";

// The one sidebar rendered by both the Admin/Reports area and the Data Entry
// area -- previously those were two visually distinct app shells (a rich
// sidebar vs. a bare top bar with a tile grid), which is what made the app
// feel like two disconnected halves. Same shell everywhere now, whichever
// URL you're actually on.
export default function AppSidebar({ role, modules }: { role: string | undefined; modules: ModuleName[] }) {
  const isFullAdmin = role === "ADMIN";
  const sections = visibleSections(isFullAdmin, modules);

  return (
    <header className="print:hidden bg-green-900 text-white p-4 flex flex-col gap-1 md:w-64 md:shrink-0">
      <div className="flex items-center justify-between md:block">
        <Link href="/admin" className="flex items-center gap-2 font-semibold text-lg">
          <Image src="/logo.png" alt="Charlie Dairy" width={36} height={36} className="rounded-full bg-green-50" priority />
          Charlie Dairy
        </Link>
        <form action={doSignOut} className="md:mt-4">
          <button type="submit" className="text-sm underline text-green-100">Sign out</button>
        </form>
      </div>
      <nav className="flex flex-col gap-3 mt-3 text-sm">
        <Link href="/admin" className="text-green-100 hover:text-white hover:underline font-medium">
          Dashboard
        </Link>
        {sections.map((s) => (
          <div key={s.key} className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-wide text-green-400 font-semibold mt-1">{s.label}</p>
            {s.items.map((item) => (
              <Link key={item.href} href={item.href} className="text-green-100 hover:text-white hover:underline pl-1">
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </header>
  );
}
