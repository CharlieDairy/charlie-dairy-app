import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-neutral-50">
      <div className="flex flex-col items-center gap-6 w-full max-w-sm">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-neutral-900">Charlie Dairy Farm</h1>
          <p className="text-neutral-500 text-sm mt-1">Sign in to continue</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
