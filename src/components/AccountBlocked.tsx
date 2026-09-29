import { doSignOut } from "@/app/actions/sign-out";

// Shown by the layouts when the signed-in account has been deactivated or
// removed since the browser session was created (sessions are stateless
// tokens, so the token itself can't know).
export default function AccountBlocked() {
  return (
    <main className="min-h-screen flex items-center justify-center farm-bg p-6">
      <div className="max-w-md bg-white border border-neutral-200 rounded-lg p-6 text-center flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-neutral-900">Account unavailable</h1>
        <p className="text-sm text-neutral-600">
          This account has been disabled or removed. If you think this is a mistake, please contact the farm administrator.
        </p>
        <form action={doSignOut}>
          <button type="submit" className="bg-green-700 text-white rounded-md px-4 py-2 font-medium">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
