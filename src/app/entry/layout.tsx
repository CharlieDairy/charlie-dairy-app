import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AppSidebar from "@/components/AppSidebar";
import AccountBlocked from "@/components/AccountBlocked";
import { getLiveUser, hasPermission } from "@/lib/access";
import { moduleForPath } from "@/lib/modules";

export default async function EntryLayout({ children }: { children: React.ReactNode }) {
  // Live lookup (not the token): role and modules reflect the database right
  // now, and a deactivated or deleted account is shut out immediately
  // instead of keeping access until its token expires.
  const user = await getLiveUser();
  if (!user) return <AccountBlocked />;

  // middleware.ts's own gate only sees the JWT's modules snapshot from
  // sign-in, so a permission revoked mid-session would otherwise stay
  // readable here until the token expires. Re-check this specific route
  // against the SAME live permissions just read above for the sidebar.
  // /entry itself (the bare menu, no specific module) is exempt, same as
  // in middleware.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const requiredModule = pathname === "/entry" ? null : moduleForPath(pathname);
  if (requiredModule && !hasPermission(user, requiredModule, "VIEW")) {
    redirect("/entry");
  }

  return (
    <div className="flex flex-col min-h-screen farm-bg md:flex-row">
      <AppSidebar role={user.role} permissions={user.permissions} />
      <main className="flex-1 p-4 md:p-8 max-w-[1600px] w-full mx-auto">{children}</main>
    </div>
  );
}
