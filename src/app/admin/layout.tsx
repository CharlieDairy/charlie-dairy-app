import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AppSidebar from "@/components/AppSidebar";
import DesktopTopBar from "@/components/DesktopTopBar";
import AccountBlocked from "@/components/AccountBlocked";
import ReadOnlyGuard from "@/components/ReadOnlyGuard";
import { getLiveUser } from "@/lib/access";
import { homeFor, roleCanOpenPath } from "@/lib/modules";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Live lookup (not the token): role and modules reflect the database right
  // now, and a deactivated or deleted account is shut out immediately
  // instead of keeping access until its token expires.
  const user = await getLiveUser();
  if (!user) return <AccountBlocked />;

  // middleware.ts's own gate only sees the role in the JWT from sign-in, so
  // a role changed mid-session would otherwise keep its old reach until the
  // token expires. Re-check this specific route against the live role.
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (!roleCanOpenPath(user.role, pathname)) {
    redirect(homeFor(user.role));
  }

  return (
    <div className="flex flex-col min-h-screen farm-bg md:flex-row">
      <AppSidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
      <DesktopTopBar role={user.role} name={user.name} />
      <main className="flex-1 min-w-0 p-4 pb-28 md:p-8 md:pb-8 max-w-[1600px] w-full mx-auto">
        {user.role === "VIEWER" || user.role === "PARTNER" ? (
          <>
            <p className="mb-4 rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-text-muted">
              {user.role === "PARTNER" ? "Partner account" : "View Only account"} — you can look at everything here but can&apos;t add, change or delete anything.
            </p>
            <ReadOnlyGuard>{children}</ReadOnlyGuard>
          </>
        ) : (
          children
        )}
      </main>
      </div>
    </div>
  );
}
