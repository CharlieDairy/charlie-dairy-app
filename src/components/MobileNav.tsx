"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { doSignOut } from "@/app/actions/sign-out";
import { NAV_SECTIONS, visibleSections } from "@/lib/nav";
import { homeFor, roleCanOpenPath } from "@/lib/modules";

// Phone navigation, in the pattern people already know from banking and
// delivery apps: a slim top bar with the page title and a menu button, a
// slide-in drawer holding the full menu, and a bottom tab bar with the few
// things used all day, plus a centre "+" for quick data entry. Hidden from
// md upwards, where the desktop sidebar (AppSidebar) takes over. Which pages
// appear is decided by the same roleCanOpenPath() the server uses, so a View
// Only user never sees an entry shortcut.

const ROLE_LABEL: Record<string, string> = { ADMIN: "Admin", EDITOR: "Editor", VIEWER: "View Only", PARTNER: "Partner" };

function Icon({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const IHome = <Icon><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></Icon>;
const IMilk = <Icon><path d="M8 2h8l-1 4v2a5 5 0 011 3v9a2 2 0 01-2 2h-4a2 2 0 01-2-2v-9a5 5 0 011-3V6z" /><path d="M8 13h8" /></Icon>;
const ISales = <Icon><circle cx="12" cy="12" r="9" /><path d="M14.5 9a2.5 2 0 00-2.5-1.5c-1.4 0-2.5.7-2.5 1.8 0 2.4 5 1.2 5 3.6 0 1.1-1.1 1.8-2.5 1.8A2.7 2.2 0 019.5 14.5" /><path d="M12 6v1.5M12 16.5V18" /></Icon>;
const IMore = <Icon><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></Icon>;
const IPlus = <Icon size={26}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Icon>;
const IClose = <Icon><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></Icon>;
const IChevron = ({ open }: { open: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true">
    <polyline points="9 6 15 12 9 18" />
  </svg>
);

function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function MobileNav({ role }: { role: string }) {
  const pathname = usePathname();
  // Remember WHERE the menu / sheet was opened: navigating anywhere changes
  // the pathname, which closes it without needing an effect.
  const [menuAt, setMenuAt] = useState<string | null>(null);
  const [addAt, setAddAt] = useState<string | null>(null);
  // null = untouched: only the section holding the current page is open.
  const [openSections, setOpenSections] = useState<Set<string> | null>(null);
  const menuOpen = menuAt === pathname;
  const addOpen = addAt === pathname;

  const sections = visibleSections(role);
  const home = homeFor(role);
  const canAdd = role !== "VIEWER" && role !== "PARTNER";

  // Title in the top bar: the most specific nav item that matches this URL.
  const allItems = NAV_SECTIONS.flatMap((s) => s.items).filter((i) => matches(pathname, i.href));
  allItems.sort((a, b) => b.href.length - a.href.length);
  const title = pathname === "/admin" ? "Dashboard" : pathname === "/entry" ? "Data Entry" : (allItems[0]?.label ?? "Charlie Dairy");

  const activeSectionKey = sections.find((s) => s.items.some((i) => matches(pathname, i.href)))?.key;

  // Quick-add sheet: the daily jobs first, then the rest -- only pages this
  // role may open (a View Only user gets no "+" at all).
  const quickAdd = [
    { href: "/entry/milking", label: "Milking" },
    { href: "/entry/milk-sale", label: "Milk Sale" },
    { href: "/entry/feed", label: "Feed" },
    { href: "/entry/cash", label: "Cash" },
    { href: "/entry/team/attendance", label: "Attendance" },
    { href: "/entry/health/treatment", label: "Treatment" },
    { href: "/entry/health/vaccination", label: "Vaccination" },
    { href: "/entry/breeding/reproduction", label: "Reproduction" },
    { href: "/entry/breeding/calving", label: "Calving" },
    { href: "/entry/weight", label: "Weight" },
    { href: "/entry/team/salary", label: "Salary Payment" },
    { href: "/entry/team/mark-absence", label: "Mark Absence" },
    { href: "/admin/cows/add", label: "Add Animal" },
  ].filter((i) => roleCanOpenPath(role, i.href));

  useEffect(() => {
    if (!menuOpen && !addOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMenuAt(null); setAddAt(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, addOpen]);

  const milkHref = canAdd ? "/entry/milking" : "/admin/reports/herd";
  const tabs: { key: string; label: string; href: string; icon: ReactNode; active: boolean }[] = [
    { key: "home", label: "Home", href: home, icon: IHome, active: pathname === home || (home === "/entry" && pathname === "/admin") },
    { key: "milk", label: "Milk", href: milkHref, icon: IMilk, active: matches(pathname, "/entry/milking") || matches(pathname, "/admin/reports/herd") || matches(pathname, "/admin/reports/milk-analytics") },
    { key: "sales", label: "Sales", href: "/admin/reports/milk-sales", icon: ISales, active: matches(pathname, "/admin/reports/milk-sales") || matches(pathname, "/entry/milk-sale") },
  ];

  const tabClass = (active: boolean) =>
    `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${active ? "text-primary-dark" : "text-text-muted"}`;

  return (
    <div className="md:hidden print:hidden">
      {/* Top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 bg-green-900 px-4 text-white" style={{ paddingTop: "env(safe-area-inset-top)", height: "calc(3.5rem + env(safe-area-inset-top))" }}>
        <Link href={home} className="shrink-0" aria-label="Home">
          <Image src="/logo.png" alt="" width={32} height={32} className="rounded-full bg-green-50" priority />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h1>
        <button type="button" onClick={() => setMenuAt(pathname)} aria-label="Open menu" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full active:bg-white/15">
          {IMore}
        </button>
      </div>

      {/* Bottom tab bar */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-stretch">
          {tabs.slice(0, 2).map((t) => (
            <Link key={t.key} href={t.href} className={tabClass(t.active)} aria-current={t.active ? "page" : undefined}>
              {t.icon}
              {t.label}
            </Link>
          ))}
          {canAdd && (
            <div className="flex flex-1 items-center justify-center">
              <button type="button" onClick={() => setAddAt(pathname)} aria-label="Add a record" className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg ring-4 ring-white active:bg-primary-dark">
                {IPlus}
              </button>
            </div>
          )}
          <Link href={tabs[2].href} className={tabClass(tabs[2].active)} aria-current={tabs[2].active ? "page" : undefined}>
            {tabs[2].icon}
            {tabs[2].label}
          </Link>
          <button type="button" onClick={() => setMenuAt(pathname)} className={tabClass(menuOpen)}>
            {IMore}
            More
          </button>
        </div>
      </nav>

      {/* Menu drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={() => setMenuAt(null)} />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-green-900 text-white shadow-2xl" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div className="flex items-center gap-3 px-4 py-3">
              <Image src="/logo.png" alt="" width={36} height={36} className="rounded-full bg-green-50" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold leading-tight">Charlie Dairy</div>
                <div className="text-xs text-green-300">{ROLE_LABEL[role] ?? role}</div>
              </div>
              <button type="button" onClick={() => setMenuAt(null)} aria-label="Close menu" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/15">
                {IClose}
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
              <Link href={home} className="flex min-h-12 items-center rounded-lg px-3 font-medium active:bg-white/10">
                {home === "/entry" ? "Data Entry Home" : "Dashboard"}
              </Link>
              {sections.map((s) => {
                const open = openSections ? openSections.has(s.key) : s.key === activeSectionKey;
                return (
                  <div key={s.key} className="mt-1">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenSections((prev) => {
                        const next = new Set(prev ?? (activeSectionKey ? [activeSectionKey] : []));
                        if (next.has(s.key)) next.delete(s.key); else next.add(s.key);
                        return next;
                      })}
                      className="flex min-h-12 w-full items-center justify-between rounded-lg px-3 text-left text-xs font-semibold uppercase tracking-wide text-green-300 active:bg-white/10"
                    >
                      {s.label}
                      <IChevron open={open} />
                    </button>
                    {open && (
                      <div className="mb-1 flex flex-col">
                        {s.items.map((item) => (
                          <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} className={`flex min-h-11 items-center rounded-lg pl-6 pr-3 text-[15px] active:bg-white/10 ${pathname === item.href ? "bg-white/15 font-semibold" : "text-green-50"}`}>
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
            <form action={doSignOut} className="border-t border-white/15 p-3">
              <button type="submit" className="flex min-h-12 w-full items-center justify-center rounded-lg bg-white/10 font-medium active:bg-white/20">
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Quick-add sheet */}
      {addOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Add a record">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={() => setAddAt(null)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[80%] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text">What do you want to record?</h2>
              <button type="button" onClick={() => setAddAt(null)} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted active:bg-neutral-100">
                {IClose}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {quickAdd.map((i) => (
                <Link key={i.href} href={i.href} className="flex min-h-16 items-center justify-center rounded-xl border border-border bg-primary-light px-3 py-3 text-center text-sm font-semibold text-primary-dark active:bg-green-100">
                  {i.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
