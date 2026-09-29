import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isValidModule, type ModuleName } from "@/lib/modules";
import { AccessError, ValidationError } from "@/lib/errors";

// ---------------------------------------------------------------------------
// Live authorization for server actions.
//
// middleware.ts only gates page navigations, and only from the JWT issued at
// sign-in -- so a deactivated user, or one whose modules were revoked, kept
// full access until their token expired, and a server action reachable by
// URL was only as protected as the route it was posted from. Every action
// now calls requireAccess() itself, which re-reads the user, their active
// flag, role and module grants from the database on every call.
// ---------------------------------------------------------------------------

export type LiveUser = {
  id: string;
  name: string;
  username: string;
  role: "ADMIN" | "ENTRY";
  modules: ModuleName[];
};

export type AccessRule = { admin?: boolean; module?: ModuleName };

/** The signed-in user as they are in the database right now, or null if signed out / disabled / deleted. */
export async function getLiveUser(): Promise<LiveUser | null> {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, username: true, role: true, active: true },
  });
  if (!user || !user.active) return null;

  const grants =
    user.role === "ADMIN"
      ? []
      : await prisma.moduleAccess.findMany({ where: { userId: id }, select: { module: true } });

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role as "ADMIN" | "ENTRY",
    modules: grants.map((g) => g.module as string).filter(isValidModule),
  };
}

/**
 * Throws AccessError unless the caller is an active user meeting `rule`.
 * ADMIN role satisfies every module. Call this first in every server action.
 */
export async function requireAccess(rule: AccessRule = {}): Promise<LiveUser> {
  const user = await getLiveUser();
  if (!user) throw new AccessError("Your session has expired or your account is disabled. Please sign in again.");
  if (rule.admin && user.role !== "ADMIN") throw new AccessError("Only an Admin can do that.");
  if (rule.module && user.role !== "ADMIN" && !user.modules.includes(rule.module)) {
    throw new AccessError("You don't have access to this section.");
  }
  return user;
}

// ---------------------------------------------------------------------------
// Crash-proofing for form actions.
// ---------------------------------------------------------------------------

type ActionState = { success: boolean; message: string } | undefined;

// redirect(), notFound() and friends work by throwing; they must pass through.
function isFrameworkSignal(e: unknown): boolean {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_") || digest === "DYNAMIC_SERVER_USAGE" || digest === "BAILOUT_TO_CLIENT_SIDE_RENDERING")
  );
}

function friendlyMessage(e: unknown): string {
  const code = (e as { code?: unknown } | null)?.code;
  if (typeof code === "string") {
    if (code === "P2002") return "A record with the same unique value already exists. Nothing was saved.";
    if (code === "P2003") return "This record is linked to other records, so the change was blocked. Nothing was saved.";
    if (code === "P2025") return "That record no longer exists. Refresh the page and try again.";
    if (["P1001", "P1002", "P1008", "P1017", "P2024", "P2028", "P2034"].includes(code)) {
      return "The database is busy or unreachable right now. Nothing was saved — please try again in a moment.";
    }
  }
  return "Something went wrong and your entry may not have been saved. Please check the record and try again.";
}

/**
 * Wraps a form action's body. Access and validation problems become a normal
 * `{ success: false, message }` result; database or unexpected errors are
 * logged and turned into a friendly message instead of a white error page.
 */
export async function runAction<T extends ActionState>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (isFrameworkSignal(e)) throw e;
    if (e instanceof AccessError || e instanceof ValidationError) {
      return { success: false, message: e.message } as unknown as T;
    }
    console.error("[action] unexpected error", e);
    return { success: false, message: friendlyMessage(e) } as unknown as T;
  }
}
