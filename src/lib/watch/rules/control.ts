import { prisma } from "@/lib/prisma";
import { type Rule, DAY_MS, addDays, key } from "../types";

export const controlRules: Rule[] = [
  {
    id: "auth.failed-logins",
    async run({ today }) {
      const now = new Date();
      const [d1, d7] = await Promise.all([
        prisma.auditLog.count({ where: { action: "login_failed", createdAt: { gte: new Date(now.getTime() - DAY_MS) } } }),
        prisma.auditLog.count({ where: { action: "login_failed", createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } } }),
      ]);
      if (d1 < 3 && d7 < 10) return [];
      return [
        {
          key: "auth.failed-logins",
          ruleId: "auth.failed-logins",
          category: "CONTROL",
          severity: d1 >= 5 ? "HIGH" : "MEDIUM",
          title: `${d1} failed sign-in${d1 === 1 ? "" : "s"} in the last 24 hours (${d7} this week)`,
          detail: "Repeated failures can be a person typing the wrong username, or someone trying to guess a password. The Audit Log shows each attempt and the username used.",
          suggestion: "Open the Audit Log and filter on login_failed. If it is a staff member, remind them of their exact username; if the names are unknown, reset the Admin password.",
          metric: { last24h: d1, last7d: d7, asOf: key(today) },
        },
      ];
    },
  },
  {
    id: "audit.bulk-deletes",
    async run() {
      const rows = await prisma.auditLog.findMany({
        where: { action: "deleteMany", createdAt: { gte: new Date(Date.now() - 7 * DAY_MS) } },
        select: { userName: true, entity: true, newValue: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      const big = rows
        .map((r) => {
          let n = 0;
          try { n = (JSON.parse(r.newValue ?? "{}") as { affectedRows?: number }).affectedRows ?? 0; } catch { /* ignore */ }
          return { ...r, n };
        })
        .filter((r) => r.n >= 50);
      if (big.length === 0) return [];
      return [
        {
          key: "audit.bulk-deletes",
          ruleId: "audit.bulk-deletes",
          category: "CONTROL",
          severity: "INFO",
          title: `${big.length} large delete${big.length === 1 ? "" : "s"} (50+ rows) in the last 7 days`,
          detail: big.slice(0, 6).map((b) => `${b.userName ?? "System / script"} removed ${b.n} ${b.entity} rows on ${key(b.createdAt)}`).join("; "),
          suggestion: "Confirm these were intended (for example a re-upload of a sheet). A full backup is taken before every history load.",
        },
      ];
    },
  },
  {
    id: "users.stale",
    async run() {
      const [users, logins] = await Promise.all([
        prisma.user.findMany({ where: { active: true }, select: { name: true, username: true, role: true } }),
        prisma.auditLog.groupBy({ by: ["userName"], where: { action: "login" }, _max: { createdAt: true } }),
      ]);
      const last = new Map(logins.map((l) => [(l.userName ?? "").trim().toLowerCase(), l._max.createdAt]));
      const cutoff = new Date(Date.now() - 30 * DAY_MS);
      const stale = users.filter((u) => {
        const t = last.get(u.name.trim().toLowerCase());
        return !t || t < cutoff;
      });
      if (stale.length === 0) return [];
      return [
        {
          key: "users.stale",
          ruleId: "users.stale",
          category: "CONTROL",
          severity: "INFO",
          title: `${stale.length} active user${stale.length === 1 ? " has" : "s have"} not signed in for 30 days`,
          detail: stale.map((u) => `${u.name} (${u.role})`).join("; "),
          suggestion: "Deactivate accounts that are no longer used (Users & Access).",
        },
      ];
    },
  },
];

export { addDays };
