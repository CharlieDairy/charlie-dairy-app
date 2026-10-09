"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
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

function SecIcon({ children }: { children: ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-90" aria-hidden="true">
      {children}
    </svg>
  );
}

// One small icon per section so the menu can be scanned by shape, not just
// by reading every label.
const SECTION_ICON: Record<string, ReactNode> = {
  herd: <SecIcon><path d="M4 8c0-2 1.5-3 3-3h10c1.5 0 3 1 3 3v6a5 5 0 01-5 5H9a5 5 0 01-5-5z" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><path d="M3 6l2 2M21 6l-2 2" /></SecIcon>,
  breeding: <SecIcon><path d="M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10z" /></SecIcon>,
  health: <SecIcon><path d="M12 8v8M8 12h8" /><rect x="3" y="3" width="18" height="18" rx="4" /></SecIcon>,
  milk: <SecIcon><path d="M8 2h8l-1 4v2a5 5 0 011 3v9a2 2 0 01-2 2h-4a2 2 0 01-2-2v-9a5 5 0 011-3V6z" /><path d="M8 13h8" /></SecIcon>,
  weight: <SecIcon><path d="M5 20h14l-2-12H7z" /><circle cx="12" cy="5" r="2" /></SecIcon>,
  feed: <SecIcon><path d="M12 22V10" /><path d="M12 10c0-4 3-6 7-6 0 4-3 6-7 6z" /><path d="M12 14c0-3-2-5-6-5 0 3 2 5 6 5z" /></SecIcon>,
  financial: <SecIcon><rect x="2" y="6" width="20" height="13" rx="2" /><circle cx="12" cy="12.5" r="2.5" /></SecIcon>,
  team: <SecIcon><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5" /><circle cx="17" cy="9" r="2.2" /><path d="M16 15c3 0 5 1.6 5 4" /></SecIcon>,
  admin: <SecIcon><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></SecIcon>,
};

// The one sidebar rendered by both the Admin/Reports area and the Data Entry
// area, same shell everywhere. On a computer it stays fixed to the screen
// while the page scrolls (sticky, with its own scrollbar for the long menu);
// on a phone it is replaced by MobileNav.
export default function AppSidebar({ role }: { role: string }) {
  const sections = visibleSections(role);
  const pathname = usePathname();

  const activeSectionKey = sections.find((s) => s.items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/")))?.key ?? null;

  // Collapsed-section keys, persisted per-browser. Defaults to "collapse
  // everything except whichever section contains the page you're on".
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
    // Only run once on mount -- navigating must not reset user toggles.
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

  const home = role === "EDITOR" ? "/entry" : "/admin";

  return (
    <>
      <MobileNav role={role} />
      <aside className="print:hidden hidden md:flex md:w-64 md:shrink-0 md:sticky md:top-0 md:h-screen flex-col bg-green-900 text-white">
        <Link href={home} className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <Image src="/logo.png" alt="" width={40} height={40} className="rounded-full bg-green-50" priority />
          <span className="leading-tight">
            <span className="block text-base font-bold">Charlie Dairy</span>
            <span className="block text-[11px] font-medium uppercase tracking-wider text-green-300">Farm management</span>
          </span>
        </Link>
        <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 text-sm [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.25)_transparent]">
          <Link
            href={home}
            className={`mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium transition-colors ${pathname === home ? "bg-white/15 text-white" : "text-green-100 hover:bg-white/10 hover:text-white"}`}
          >
            <SecIcon><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></SecIcon>
            {home === "/entry" ? "Data Entry Home" : "Dashboard"}
          </Link>
          {sections.map((s) => {
            const isOpen = hydrated ? !collapsed.has(s.key) : s.key === activeSectionKey || !activeSectionKey;
            const isActiveSection = s.key === activeSectionKey;
            return (
              <div key={s.key} className="mt-1">
                <button
                  type="button"
                  onClick={() => toggle(s.key)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition-colors hover:bg-white/10 ${isActiveSection ? "text-white" : "text-green-200"}`}
                  aria-expanded={isOpen}
                >
                  {SECTION_ICON[s.key]}
                  <span className="flex-1">{s.label}</span>
                  <Chevron open={isOpen} />
                </button>
                {isOpen && (
                  <div className="ml-[22px] mt-0.5 flex flex-col border-l border-white/15 pl-2">
                    {s.items.map((item) => {
                      const active = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={`rounded-md px-3 py-1.5 text-[13px] transition-colors ${active ? "bg-white/15 font-semibold text-white" : "text-green-100/90 hover:bg-white/10 hover:text-white"}`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
