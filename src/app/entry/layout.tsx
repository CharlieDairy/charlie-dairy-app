import { auth } from "@/auth";
import AppSidebar from "@/components/AppSidebar";
import type { ModuleName } from "@/lib/modules";

export default async function EntryLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const modules = ((session?.user as { modules?: string[] } | undefined)?.modules ?? []) as ModuleName[];

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 md:flex-row">
      <AppSidebar role={role} modules={modules} />
      <main className="flex-1 p-4 md:p-8 max-w-2xl w-full mx-auto">{children}</main>
    </div>
  );
}
