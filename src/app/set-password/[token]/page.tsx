import Image from "next/image";
import Link from "next/link";
import { findValidToken } from "@/lib/passwordTokens";
import SetPasswordForm from "./SetPasswordForm";

export default async function SetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await findValidToken(token);

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-background">
      <div className="flex flex-col items-center gap-6 w-full max-w-sm">
        <div className="text-center flex flex-col items-center gap-2">
          <Image src="/logo.png" alt="Charlie Dairy" width={80} height={80} priority />
          {valid ? (
            <>
              <h1 className="text-2xl font-semibold text-neutral-900">{valid.purpose === "INVITE" ? "Welcome" : "Reset password"}</h1>
              <p className="text-neutral-500 text-sm">
                {valid.purpose === "INVITE"
                  ? `You've been invited to Charlie Dairy Farm, ${valid.user.name}. Choose a password for ${valid.user.username}.`
                  : `Choose a new password for ${valid.user.username}.`}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-neutral-900">Link not valid</h1>
              <p className="text-neutral-500 text-sm">This link has expired or was already used. Ask your Admin to send you a new one.</p>
            </>
          )}
        </div>
        {valid ? <SetPasswordForm token={token} /> : null}
        <Link href="/login" className="text-sm text-neutral-500 underline">
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
