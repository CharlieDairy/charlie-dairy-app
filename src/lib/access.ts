import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AccessError, ValidationError } from "@/lib/errors";
import type { PermissionActionKey, PermissionModuleKey } from "@/lib/permissions";
import { farmDateKey } from "@/lib/reports/dashboardMetrics";

// ---------------------------------------------------------------------------
// Live authorization for server actions.
//
// middleware.ts only gates page navigations, and only from the JWT issued at
// sign-in -- so a deactivated user, or one whose access role changed, kept
// full access until their token expired, and a server action reachable by
// URL was only as protected as the route it was posted from. Every action
// now calls requirePermission() itself, which re-reads the user, their
// active flag and role from the database on every call.
// ---------------------------------------------------------------------------

// Three fixed roles:
//   ADMIN   -- everything.
//   EDITOR  -- read, add, edit and delete in every module EXCEPT the Admin
//              panel. (The Admin-only reports -- P&L, Balance Sheet, Capital
//              Ledger, Assets, Cash Flow -- and Customer / master-data
//              changes are blocked by isAdminOnlyPath() and requireAccess().)
//   VIEWER  -- read only, same exclusions as Editor.
export type LiveUser = {
  id: string;
  name: string;
  username: string;
  role: "ADMIN" | "EDITOR" | "VIEWER";
};

export type AccessRule = { admin?: boolean };

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

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role as LiveUser["role"],
  };
}

/** True if this live user may do `action` in `module` (see role rules above). */
export function hasPermission(user: LiveUser, module: PermissionModuleKey | string, action: PermissionActionKey): boolean {
  if (user.role === "ADMIN") return true;
  if (module === "admin") return false;
  if (user.role === "EDITOR") return true;
  return action === "VIEW";
}

/** True if this user can add/edit/delete data anywhere (Admin or Editor). */
export function canWrite(user: Pick<LiveUser, "role"> | null | undefined): boolean {
  return user?.role === "ADMIN" || user?.role === "EDITOR";
}

/**
 * Throws AccessError unless the caller is an active user whose role allows
 * `module:action` (ADMIN everything; EDITOR everything outside the Admin
 * module; VIEWER read-only). Call this first in every server action that
 * creates, edits, deletes or exports something.
 */
export async function requirePermission(module: PermissionModuleKey, action: PermissionActionKey): Promise<LiveUser> {
  const user = await getLiveUser();
  if (!user) throw new AccessError("Your session has expired or your account is disabled. Please sign in again.");
  if (!hasPermission(user, module, action)) {
    throw new AccessError("You don't have permission to do that.");
  }
  return user;
}

/** For the handful of actions that are ADMIN-role-only regardless of any AccessRole (e.g. bulk deletes, role changes). */
export async function requireAccess(rule: AccessRule = {}): Promise<LiveUser> {
  const user = await getLiveUser();
  if (!user) throw new AccessError("Your session has expired or your account is disabled. Please sign in again.");
  if (rule.admin && user.role !== "ADMIN") throw new AccessError("Only an Admin can do that.");
  return user;
}

/**
 * Non-Admin roles may only add information with today's date (farm-local,
 * Asia/Karachi) -- a past date on a new entry is an Admin-only override.
 * Admin is always exempt. Call this after reading a `date` field in any
 * CREATE action a non-Admin role can reach.
 */
export function assertNotBackdated(date: Date, user: LiveUser, label = "Date"): void {
  if (user.role === "ADMIN") return;
  const entryKey = date.toISOString().slice(0, 10);
  if (entryKey < farmDateKey()) {
    throw new ValidationError(`${label} can't be backdated. Only an Admin can enter a past date.`);
  }
}

/**
 * For edits: an Editor may correct a record in place, but may not use an edit
 * to move it onto a past date (that would be back-dating by the side door).
 * Leaving the date unchanged is always fine, whatever day the record is from.
 */
export function assertDateChangeNotBackdated(newDate: Date, oldDate: Date, user: LiveUser, label = "Date"): void {
  if (newDate.toISOString().slice(0, 10) === oldDate.toISOString().slice(0, 10)) return;
  assertNotBackdated(newDate, user, label);
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
