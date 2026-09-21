import Link from "next/link";
import { auth } from "@/auth";
import { doSignOut } from "@/app/actions/sign-out";

export default async function EntryLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const modules = (session?.user as { modules?: string[] } | undefined)?.modules ?? [];
  // Matches middleware's own gate for the bare /admin dashboard: full admins
  // always qualify, and an ENTRY user qualifies once they hold any module
  // grant at all (e.g. a Farm Manager with just Operations) -- otherwise
  // /admin would redirect them straight back here anyway.
  const canSeeAdmin = role === "ADMIN" || modules.length > 0;

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-neutral-50">
      <header className="bg-green-800 text-white px-4 py-3 flex items-center justify-between">
        <Link href="/entry" className="font-semibold">
          Charlie Dairy — Data Entry
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {canSeeAdmin && (
            <Link href="/admin" className="underline">
              {role === "ADMIN" ? "Admin" : "Dashboard"}
            </Link>
          )}
          <form action={doSignOut}>
            <button type="submit" className="underline">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-4 max-w-2xl w-full mx-auto">{children}</main>
    </div>
  );
}
