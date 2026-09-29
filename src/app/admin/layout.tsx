import AppSidebar from "@/components/AppSidebar";
import AccountBlocked from "@/components/AccountBlocked";
import { getLiveUser } from "@/lib/access";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Live lookup (not the token): role and modules reflect the database right
  // now, and a deactivated or deleted account is shut out immediately
  // instead of keeping access until its token expires.
  const user = await getLiveUser();
  if (!user) return <AccountBlocked />;

  return (
    <div className="flex flex-col min-h-screen farm-bg md:flex-row">
      <AppSidebar role={user.role} permissions={user.permissions} />
      <main className="flex-1 p-4 md:p-8 max-w-[1600px] w-full mx-auto">{children}</main>
    </div>
  );
}
