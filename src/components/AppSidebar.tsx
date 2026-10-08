"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { doSignOut } from "@/app/actions/sign-out";
import { visibleSections } from "@/lib/nav";
import MobileNav from "@/components/MobileNav";

const STORAGE_KEY = "charlie-sidebar-collapsed";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform shrink-0 ${open ? "rotate-90" : ""}`}
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

// The one sidebar rendered by both the Admin/Reports area and the Data Entry
// area -- previously those were two visually distinct app shells (a rich
// sidebar vs. a bare top bar with a tile grid), which is what made the app
// feel like two disconnected halves. Same shell everywhere now, whichever
// URL you're actually on.
export default function AppSidebar({ role }: { role: string }) {
  const sections = visibleSections(role);
  const pathname = usePathname();

  const activeSectionKey = sections.find((s) => s.items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/")))?.key ?? null;

  // Collapsed-section keys, persisted per-browser so a farm worker's layout
  // preference survives reloads. Defaults to "collapse everything except
  // whichever section contains the page you're currently on" -- with 10
  // sections now, showing every item at once made the sidebar too long to
  // scan.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let stored: string[] | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      stored = raw ? JSON.parse(raw) : null;
    } catch {
      stored = null;
    }
    const initial = stored ?? sections.map((s) => s.key).filter((k) => k !== activeSectionKey);
    setCollapsed(new Set(initial));
    setHydrated(true);
    // Only run once on mount -- section list/active key don't need to
    // re-trigger this, otherwise navigating would reset user toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // ignore -- private browsing / blocked storage
      }
      return next;
    });
  }

  return (
    <>
    <MobileNav role={role} />
    <header className="print:hidden bg-green-900 text-white p-4 hidden md:flex flex-col gap-1 md:w-64 md:shrink-0">
      <div className="flex items-center justify-between md:block">
        <Link href="/admin" className="flex items-center gap-2 font-semibold text-lg">
          <Image src="/logo.png" alt="Charlie Dairy" width={36} height={36} className="rounded-full bg-green-50" priority />
          Charlie Dairy
        </Link>
        <form action={doSignOut} className="md:mt-4">
          <button type="submit" className="text-sm underline text-green-100">Sign out</button>
        </form>
      </div>
      <nav className="flex flex-col gap-1 mt-3 text-sm">
        <Link href="/admin" className="text-green-100 hover:text-white hover:underline font-medium pb-2">
          Dashboard
        </Link>
        {sections.map((s) => {
          const isOpen = hydrated ? !collapsed.has(s.key) : s.key === activeSectionKey || !activeSectionKey;
          return (
            <div key={s.key} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => toggle(s.key)}
                className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-green-400 font-semibold mt-1 py-1 hover:text-green-200 w-full text-left"
                aria-expanded={isOpen}
              >
                <Chevron open={isOpen} />
                {s.label}
              </button>
              {isOpen && (
                <div className="flex flex-col gap-1">
                  {s.items.map((item) => (
                    <Link key={item.href} href={item.href} className="text-green-100 hover:text-white hover:underline pl-4">
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </header>
    </>
  );
}
