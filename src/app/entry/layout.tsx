import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AppSidebar from "@/components/AppSidebar";
import DesktopTopBar from "@/components/DesktopTopBar";
import AccountBlocked from "@/components/AccountBlocked";
import { getLiveUser } from "@/lib/access";
import { homeFor, roleCanOpenPath } from "@/lib/modules";

export default async function EntryLayout({ children }: { children: React.ReactNode }) {
  // Live lookup (not the token): role and modules reflect the database right
  // now, and a deactivated or deleted account is shut out immediately
  // instead of keeping access until its token expires.
  const user = await getLiveUser();
  if (!user) return <AccountBlocked />;

  // Re-check this route against the live role (see admin/layout.tsx).
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (!roleCanOpenPath(user.role, pathname)) {
    redirect(homeFor(user.role));
  }

  return (
    <div className="flex flex-col min-h-screen farm-bg md:flex-row">
      <AppSidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DesktopTopBar role={user.role} name={user.name} />
        <main className="flex-1 min-w-0 p-4 pb-28 md:p-8 md:pb-8 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
