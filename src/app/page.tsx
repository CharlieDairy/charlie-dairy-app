import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { homeFor } from "@/lib/modules";

export default async function Home() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  redirect(homeFor(role));
}
