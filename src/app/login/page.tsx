import Image from "next/image";
import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ set?: string }> }) {
  const { set } = await searchParams;

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-background">
      <div className="flex flex-col items-center gap-6 w-full max-w-sm">
        <div className="text-center flex flex-col items-center gap-2">
          <Image src="/logo.png" alt="Charlie Dairy" width={80} height={80} priority />
          <h1 className="text-2xl font-semibold text-neutral-900">Charlie Dairy Farm</h1>
          <p className="text-neutral-500 text-sm">Sign in to continue</p>
          <p className="text-neutral-400 text-xs">Access is by invitation only — ask your Admin for an account.</p>
        </div>
        {set === "1" && (
          <p className="w-full rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700" role="status">
            Password saved. Sign in with your new password.
          </p>
        )}
        <LoginForm />
      </div>
    </div>
  );
}
