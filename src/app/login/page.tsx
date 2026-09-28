import Image from "next/image";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-background">
      <div className="flex flex-col items-center gap-6 w-full max-w-sm">
        <div className="text-center flex flex-col items-center gap-2">
          <Image src="/logo.png" alt="Charlie Dairy" width={80} height={80} priority />
          <h1 className="text-2xl font-semibold text-neutral-900">Charlie Dairy Farm</h1>
          <p className="text-neutral-500 text-sm">Sign in to continue</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
