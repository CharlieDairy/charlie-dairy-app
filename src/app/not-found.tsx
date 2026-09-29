import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md bg-white border border-neutral-200 rounded-lg p-6 text-center flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-neutral-900">Page not found</h1>
        <p className="text-sm text-neutral-600">
          That page or record doesn&apos;t exist — it may have been deleted or the link is out of date.
        </p>
        <Link href="/" className="self-center bg-green-700 text-white rounded-md px-4 py-2 font-medium">
          Go to the dashboard
        </Link>
      </div>
    </main>
  );
}
