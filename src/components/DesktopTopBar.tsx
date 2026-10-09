"use client";

import { usePathname } from "next/navigation";
import { doSignOut } from "@/app/actions/sign-out";
import { NAV_SECTIONS } from "@/lib/nav";

const ROLE_LABEL: Record<string, string> = { ADMIN: "Admin", EDITOR: "Editor", VIEWER: "View Only" };
const ROLE_CHIP: Record<string, string> = {
  ADMIN: "bg-amber-100 text-amber-800",
  EDITOR: "bg-green-100 text-green-800",
  VIEWER: "bg-neutral-200 text-neutral-700",
};

// Slim bar across the top of every page on a computer: where you are
// (Section / Page) on the left, who you are and Sign out on the right. On a
// phone this job is done by MobileNav's top bar instead.
export default function DesktopTopBar({ role, name }: { role: string; name: string }) {
  const pathname = usePathname();

  const matches = NAV_SECTIONS.flatMap((s) => s.items.map((i) => ({ section: s.label, page: i.label, href: i.href }))).filter(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/"),
  );
  matches.sort((x, y) => y.href.length - x.href.length);
  let { section, page } = matches[0] ?? { section: "", page: "" };
  if (pathname === "/admin") { section = ""; page = "Dashboard"; }
  if (pathname === "/entry") { section = ""; page = "Data Entry"; }

  return (
    <div className="print:hidden sticky top-0 z-20 hidden h-14 items-center justify-between gap-4 border-b border-border bg-white/90 px-8 backdrop-blur md:flex">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        {section && <span className="truncate text-text-muted">{section}</span>}
        {section && <span className="text-text-muted">/</span>}
        <span className="truncate font-semibold text-text">{page || "Charlie Dairy"}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm text-text">{name}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_CHIP[role] ?? "bg-neutral-200 text-neutral-700"}`}>{ROLE_LABEL[role] ?? role}</span>
        <form action={doSignOut}>
          <button type="submit" className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-text-muted hover:bg-primary-light hover:text-primary-dark">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
