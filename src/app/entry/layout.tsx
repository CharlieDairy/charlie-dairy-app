import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AppSidebar from "@/components/AppSidebar";
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
      <main className="flex-1 p-4 md:p-8 max-w-[1600px] w-full mx-auto">{children}</main>
    </div>
  );
}
