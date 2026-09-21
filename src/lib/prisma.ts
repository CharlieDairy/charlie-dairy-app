import { PrismaClient } from "@prisma/client";

// Every write (create/update/upsert/delete, single or bulk) on every model
// except AuditLog itself is recorded automatically here, so no individual
// server action needs to remember to log anything — new mutations get
// covered by construction, not by convention.
const WRITE_OPS = new Set(["create", "update", "upsert", "delete", "createMany", "updateMany", "deleteMany"]);
const BULK_OPS = new Set(["createMany", "updateMany", "deleteMany"]);
const SENSITIVE_KEYS = new Set(["passwordHash"]);

function redact(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return `[${value.length} items]`;
  const clone: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    clone[k] = SENSITIVE_KEYS.has(k) ? "[redacted]" : v;
  }
  return clone;
}

interface FindUniqueDelegate {
  findUnique: (args: { where: { id: string } }) => Promise<unknown>;
}

function getDelegate(client: PrismaClient, model: string): FindUniqueDelegate | null {
  const key = model.charAt(0).toLowerCase() + model.slice(1);
  const value = (client as unknown as Record<string, unknown>)[key];
  if (value && typeof value === "object" && "findUnique" in value) {
    return value as FindUniqueDelegate;
  }
  return null;
}

// SQLite has exactly one writer for the whole database file. `base` here is
// a second connection from the audited write's — when that write happens
// inside an interactive prisma.$transaction(), the transaction's connection
// holds SQLite's write lock until its callback returns, but the callback
// can't return until this second-connection query finishes: a genuine
// deadlock, not just slowness. Discovered in practice (not just reasoned
// about) when recording a milk sale payment hung and then failed. Racing
// against a short timeout bounds the wait instead of blocking on SQLite's
// own multi-second busy_timeout, which was long enough to blow through the
// transaction's own timeout and cascade into a second failure.
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  // Swallow a late rejection from the original promise once the timeout has
  // already won the race — otherwise it surfaces as an unhandled rejection
  // when it eventually settles after we've moved on.
  const safe = promise.catch(() => fallback);
  return Promise.race([safe, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

async function recordAuditEntry(
  base: PrismaClient,
  model: string,
  operation: string,
  args: unknown,
  result: unknown,
  before: unknown
) {
  try {
    // Dynamic import (not a top-level one) so this module never statically
    // depends on auth.ts, which itself imports { prisma } from here — a
    // top-level import would be a circular dependency.
    const { auth } = await import("@/auth");
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
    const userName = session?.user?.name ?? null;

    const typedArgs = args as { where?: { id?: string }; data?: unknown };
    const whereId = typedArgs.where?.id ?? null;
    const entityId = whereId ?? (result as { id?: string } | null)?.id ?? null;

    let newValue: string | null = null;
    if (BULK_OPS.has(operation)) {
      const count = Array.isArray(typedArgs.data) ? typedArgs.data.length : ((result as { count?: number } | null)?.count ?? null);
      newValue = JSON.stringify({ affectedRows: count });
    } else if (typedArgs.data) {
      newValue = JSON.stringify(redact(typedArgs.data));
    }

    await base.auditLog.create({
      data: {
        userId,
        userName,
        action: operation,
        entity: model,
        entityId,
        oldValue: before ? JSON.stringify(redact(before)) : null,
        newValue,
      },
    });
  } catch (e) {
    console.error("[audit] failed to record log entry", e);
  }
}

function buildClient() {
  const base = new PrismaClient();

  return base.$extends({
    name: "auditLog",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (model === "AuditLog" || !WRITE_OPS.has(operation)) {
            return query(args);
          }

          const whereId = (args as { where?: { id?: string } }).where?.id ?? null;

          let before: unknown = null;
          if ((operation === "update" || operation === "delete") && whereId) {
            const delegate = getDelegate(base, model);
            if (delegate) {
              // 300ms budget: comfortably covers a normal read, but bails
              // out fast if `base`'s connection is contended (see
              // withTimeout's comment) rather than risking a multi-second
              // SQLite busy_timeout wait that could cascade into the
              // enclosing transaction timing out too.
              before = await withTimeout(delegate.findUnique({ where: { id: whereId } }).catch(() => null), 300, null);
            }
          }

          const result = await query(args);

          // Not awaited: this write must never block the operation it's
          // logging from returning. If it's competing with an open
          // transaction's connection, it'll simply complete a moment later
          // once that transaction commits and releases SQLite's write lock
          // — see the withTimeout comment above for why awaiting it here
          // caused a real deadlock.
          void recordAuditEntry(base, model, operation, args, result, before);

          return result;
        },
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof buildClient> };

export const prisma = globalForPrisma.prisma ?? buildClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
