import Link from "next/link";
import { auth } from "@/auth";
import { doSignOut } from "@/app/actions/sign-out";

export default async function EntryLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-neutral-50">
      <header className="bg-green-800 text-white px-4 py-3 flex items-center justify-between">
        <Link href="/entry" className="font-semibold">
          Charlie Dairy — Data Entry
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {role === "ADMIN" && (
            <Link href="/admin" className="underline">
              Admin
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
