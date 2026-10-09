import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { type FindingDraft, type Rule, makeContext } from "./types";
import { dataEntryRules } from "./rules/dataEntry";
import { qualityRules } from "./rules/quality";
import { feedRules } from "./rules/feed";
import { herdRules } from "./rules/herd";
import { controlRules } from "./rules/control";
import { integrityRules } from "./rules/integrity";
import { accountingRules } from "./rules/accounting";
import { gapRules } from "./rules/gaps";

export const ALL_RULES: Rule[] = [
  ...dataEntryRules,
  ...qualityRules,
  ...feedRules,
  ...herdRules,
  ...controlRules,
  ...integrityRules,
  ...accountingRules,
  ...gapRules,
];

export type WatchRunResult = {
  durationMs: number;
  open: number;
  created: number;
  resolved: number;
  ruleErrors: { rule: string; error: string }[];
};

/**
 * Runs every rule, then brings the WatchFinding table in line with what they
 * report: a problem that is still present is updated in place (and reopened if
 * someone had resolved it), a new one is created, and one that has gone away
 * is marked resolved. A rule that crashed leaves its findings alone rather than
 * wrongly "resolving" them. Rules run two at a time on purpose: the database
 * allows only a couple of connections per server instance.
 */
export async function runWatch(opts: { trigger: "manual" | "auto"; byUser?: string | null }): Promise<WatchRunResult> {
  const started = Date.now();
  const ctx = makeContext();
  const drafts = new Map<string, FindingDraft>();
  const ruleErrors: { rule: string; error: string }[] = [];
  const failed = new Set<string>();

  // Two at a time: the connection pool per server instance is capped at 2.
  const queue = [...ALL_RULES];
  const worker = async () => {
    for (let rule = queue.shift(); rule; rule = queue.shift()) {
      try {
        for (const d of await rule.run(ctx)) drafts.set(d.key, d);
      } catch (e) {
        ruleErrors.push({ rule: rule.id, error: (e instanceof Error ? e.message : String(e)).slice(0, 300) });
        failed.add(rule.id);
      }
    }
  };
  await Promise.all([worker(), worker()]);

  const existing = await prisma.watchFinding.findMany();
  const byKey = new Map(existing.map((f) => [f.key, f]));
  const now = new Date();
  const toCreate: Prisma.WatchFindingCreateManyInput[] = [];
  const updates: Record<string, unknown>[] = [];
  const toResolve: string[] = [];
  let resolvedCount = 0;

  for (const d of drafts.values()) {
    const ex = byKey.get(d.key);
    const fields = {
      ruleId: d.ruleId,
      category: d.category,
      severity: d.severity,
      title: d.title,
      detail: d.detail,
      suggestion: d.suggestion ?? null,
      metric: (d.metric ?? undefined) as Prisma.InputJsonValue | undefined,
      financeOnly: d.financeOnly ?? false,
    };
    if (!ex) {
      toCreate.push({ key: d.key, ...fields, firstSeen: now, lastSeen: now });
      continue;
    }
    let status = ex.status;
    let resolvedAt = ex.resolvedAt;
    let snoozedUntil = ex.snoozedUntil;
    if (ex.status === "RESOLVED" && !d.sticky) {
      status = "OPEN";
      resolvedAt = null;
    } else if (ex.status === "SNOOZED" && ex.snoozedUntil && ex.snoozedUntil <= now) {
      status = "OPEN";
      snoozedUntil = null;
    }
    updates.push({
      id: ex.id,
      ruleId: fields.ruleId,
      category: fields.category,
      severity: fields.severity,
      title: fields.title,
      detail: fields.detail,
      suggestion: fields.suggestion,
      metric: fields.metric ?? null,
      financeOnly: fields.financeOnly,
      status,
      resolvedAt: resolvedAt ? resolvedAt.toISOString() : null,
      snoozedUntil: snoozedUntil ? snoozedUntil.toISOString() : null,
    });
  }

  for (const ex of existing) {
    if (!drafts.has(ex.key) && ex.status !== "RESOLVED" && !failed.has(ex.ruleId)) {
      toResolve.push(ex.id);
      resolvedCount++;
    }
  }

  if (toCreate.length) await prisma.watchFinding.createMany({ data: toCreate, skipDuplicates: true });
  // One statement for all still-present findings (a round trip each would be slow).
  if (updates.length) {
    await prisma.$executeRaw`
      UPDATE "WatchFinding" AS w SET
        "ruleId" = v."ruleId", category = v.category, severity = v.severity::"WatchSeverity",
        title = v.title, detail = v.detail, suggestion = v.suggestion, metric = v.metric,
        "financeOnly" = v."financeOnly", status = v.status::"WatchStatus",
        "resolvedAt" = v."resolvedAt"::timestamp, "snoozedUntil" = v."snoozedUntil"::timestamp,
        "lastSeen" = ${now}, "seenCount" = w."seenCount" + 1
      FROM jsonb_to_recordset(${JSON.stringify(updates)}::jsonb) AS v(
        id text, "ruleId" text, category text, severity text, title text, detail text, suggestion text,
        metric jsonb, "financeOnly" boolean, status text, "resolvedAt" text, "snoozedUntil" text)
      WHERE w.id = v.id`;
  }
  if (toResolve.length) await prisma.watchFinding.updateMany({ where: { id: { in: toResolve } }, data: { status: "RESOLVED", resolvedAt: now } });

  const open = await prisma.watchFinding.count({ where: { status: { in: ["OPEN", "ACKNOWLEDGED", "SNOOZED"] } } });
  const durationMs = Date.now() - started;
  await prisma.watchRun.create({
    data: {
      durationMs,
      trigger: opts.trigger,
      byUser: opts.byUser ?? null,
      openCount: open,
      newCount: toCreate.length,
      resolvedCount,
      ruleErrors: ruleErrors.length ? (ruleErrors as unknown as Prisma.InputJsonValue) : undefined,
    },
  });
  return { durationMs, open, created: toCreate.length, resolved: resolvedCount, ruleErrors };
}
