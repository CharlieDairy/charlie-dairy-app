import Image from "next/image";
import Link from "next/link";
import ForgotPasswordForm from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-background">
      <div className="flex flex-col items-center gap-6 w-full max-w-sm">
        <div className="text-center flex flex-col items-center gap-2">
          <Image src="/logo.png" alt="Charlie Dairy" width={80} height={80} priority />
          <h1 className="text-2xl font-semibold text-neutral-900">Forgot password</h1>
          <p className="text-neutral-500 text-sm">
            Enter your username. Your Admin will be notified and can send you a one-time link to set a new password.
          </p>
        </div>
        <ForgotPasswordForm />
        <Link href="/login" className="text-sm text-neutral-500 underline">
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
