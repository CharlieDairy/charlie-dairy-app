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
              before = await delegate.findUnique({ where: { id: whereId } }).catch(() => null);
            }
          }

          const result = await query(args);

          await recordAuditEntry(base, model, operation, args, result, before);

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
