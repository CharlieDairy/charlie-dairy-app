import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

export type AuditLogRow = {
  id: string;
  userName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
};

export async function getAuditLogPage(opts: { page?: number; entity?: string; user?: string }): Promise<{
  rows: AuditLogRow[];
  page: number;
  totalPages: number;
  total: number;
}> {
  const page = Math.max(1, opts.page ?? 1);
  const where = {
    ...(opts.entity ? { entity: opts.entity } : {}),
    ...(opts.user ? { userName: opts.user } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { rows, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total };
}

export async function getAuditLogFilters(): Promise<{ entities: string[]; users: string[] }> {
  const [entities, users] = await Promise.all([
    prisma.auditLog.findMany({ select: { entity: true }, distinct: ["entity"], orderBy: { entity: "asc" } }),
    prisma.auditLog.findMany({
      where: { NOT: { userName: null } },
      select: { userName: true },
      distinct: ["userName"],
      orderBy: { userName: "asc" },
    }),
  ]);
  return {
    entities: entities.map((e) => e.entity),
    users: users.map((u) => u.userName as string),
  };
}
