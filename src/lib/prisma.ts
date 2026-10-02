import { PrismaClient } from "@prisma/client";
import { after } from "next/server";

// Every write (create/update/upsert/delete, single or bulk) on every model
// except AuditLog itself is recorded automatically here, so no individual
// server action needs to remember to log anything — new mutations get
// covered by construction, not by convention.
const WRITE_OPS = new Set(["create", "update", "upsert", "delete", "createMany", "updateMany", "deleteMany"]);
const BULK_OPS = new Set(["createMany", "updateMany", "deleteMany"]);
const SENSITIVE_KEYS = new Set(["passwordHash", "tokenHash"]);

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

// Bounds how long a best-effort side query (the "before" snapshot, the audit
// write) may delay the real operation. On timeout or failure the fallback is
// used instead -- an audit hiccup must never fail or hang the write it's
// describing.
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  // Swallow a late rejection from the original promise once the timeout has
  // already won the race -- otherwise it surfaces as an unhandled rejection
  // when it eventually settles after we've moved on.
  const safe = promise.catch(() => fallback);
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([safe, timeout]).finally(() => clearTimeout(timer));
}

type AuditEntry = {
  userId: string | null;
  userName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  oldValue: string | null;
  newValue: string | null;
};

// Works out *what* to log (who, what changed) without touching the database,
// so it is cheap and can't contend with an open transaction.
async function buildAuditEntry(
  model: string,
  operation: string,
  args: unknown,
  result: unknown,
  before: unknown
): Promise<AuditEntry | null> {
  try {
    // Dynamic import (not a top-level one) so this module never statically
    // depends on auth.ts, which itself imports { prisma } from here — a
    // top-level import would be a circular dependency.
    // Outside a request (scripts, backfills) there is no session to read;
    // that used to throw and silently drop the entry. Log it as a System
    // write instead so those changes still leave a trail.
    let userId: string | null = null;
    let userName: string | null = null;
    try {
      const { auth } = await import("@/auth");
      const session = await auth();
      userId = (session?.user as { id?: string } | undefined)?.id ?? null;
      userName = session?.user?.name ?? null;
    } catch {
      /* no request context */
    }

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

    return {
      userId,
      userName,
      action: operation,
      entity: model,
      entityId,
      oldValue: before ? JSON.stringify(redact(before)) : null,
      newValue,
    };
  } catch (e) {
    console.error("[audit] failed to build log entry", e);
    return null;
  }
}

// Retried because the usual failure is a transient "too many connections"
// from the database; losing the entry there is exactly how the log ended up
// with gaps.
async function writeAuditEntry(base: PrismaClient, entry: AuditEntry) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await base.auditLog.create({ data: entry });
      return;
    } catch (e) {
      if (attempt === 3) {
        console.error("[audit] failed to record log entry", e);
        return;
      }
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
}

// The insert runs via after(): it executes once the response has been sent
// but the serverless function is kept alive until it finishes. A plain
// un-awaited promise (what this used to be) can be frozen and lost the moment
// the response goes out on Vercel, while awaiting it inline can starve a
// small connection pool while a transaction holds the only connection.
// Outside a request (scripts, tests) after() throws, so fall back to a
// normal fire-and-forget write there.
function scheduleAuditWrite(base: PrismaClient, entry: AuditEntry) {
  try {
    after(() => writeAuditEntry(base, entry));
  } catch {
    void writeAuditEntry(base, entry);
  }
}

// The database allows 45 connections for this role in total, and every
// serverless instance (each route can be its own) used to keep a default-size
// pool of idle connections open -- ~20 were idle at low traffic, and a few
// extra instances during a deploy or a burst hit "too many connections"
// (P2037), which broke pages like the Audit Log and dropped audit writes.
// A small per-instance pool keeps the total well under the cap.
function databaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw || !/^postgres(ql)?:/.test(raw)) return raw;
  const url = new URL(raw);
  if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "2");
  if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "20");
  return url.toString();
}

function buildClient() {
  const url = databaseUrl();
  const base = url ? new PrismaClient({ datasources: { db: { url } } }) : new PrismaClient();

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
              before = await withTimeout(delegate.findUnique({ where: { id: whereId } }).catch(() => null), 1500, null);
            }
          }

          const result = await query(args);

          const entry = await withTimeout(buildAuditEntry(model, operation, args, result, before), 1500, null);
          if (entry) scheduleAuditWrite(base, entry);

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
