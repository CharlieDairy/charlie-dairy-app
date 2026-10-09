import Link from "next/link";
import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { formatRs } from "@/lib/format";
import { periodRange } from "@/lib/reports/herd";
import { resolvePeriod } from "@/lib/period";
import PeriodBar from "@/components/PeriodBar";
import { CLASS_LABEL, classifyCash } from "@/lib/accounting/cashClass";
import CashRegisterTable from "./CashRegisterTable";

type ModeFilter = "ALL" | "CASH" | "BANK";

function runningBalances(rows: { amountIn: number; amountOut: number }[], opening: number): number[] {
  const out: number[] = [];
  let sum = opening;
  for (const r of rows) {
    sum += r.amountIn - r.amountOut;
    out.push(sum);
  }
  return out;
}

function SummaryBox({ label, value, tone, icon }: { label: string; value: string; tone: "indigo" | "green" | "red"; icon: ReactNode }) {
  const chip = tone === "green" ? "bg-green-100 text-green-700" : tone === "red" ? "bg-red-100 text-red-600" : "bg-indigo-100 text-indigo-600";
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-semibold leading-none ${chip}`}>{icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-medium text-neutral-600">{label}</div>
        <div className="text-xl font-semibold text-neutral-900 truncate">{value}</div>
      </div>
    </div>
  );
}

export default async function CashRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const { period, from, to } = await resolvePeriod(params, "month");
  const range = periodRange(period, new Date(), from, to);
  const mode: ModeFilter = params.mode === "CASH" || params.mode === "BANK" ? params.mode : "ALL";
  const modeWhere = mode === "ALL" ? {} : { mode };

  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const [transactions, before, categoryRows, vendors, customers] = await Promise.all([
    prisma.cashTransaction.findMany({
      where: { date: { gte: range.start, lt: range.end }, ...modeWhere },
      orderBy: [{ date: "asc" }, { entryNo: "asc" }],
    }),
    prisma.cashTransaction.aggregate({ where: { date: { lt: range.start }, ...modeWhere }, _sum: { amountIn: true, amountOut: true } }),
    prisma.cashTransaction.findMany({ select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } }),
    prisma.vendor.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  const editorIds = [...new Set(transactions.map((t) => t.updatedById).filter((x): x is string => !!x))];
  const editors = editorIds.length ? await prisma.user.findMany({ where: { id: { in: editorIds } }, select: { id: true, name: true } }) : [];
  const editorName = new Map(editors.map((u) => [u.id, u.name]));

  const categories = categoryRows.map((r) => r.category);
  const vendorNames = vendors.map((v) => v.name);

  const opening = (before._sum.amountIn ?? 0) - (before._sum.amountOut ?? 0);
  const totalIn = transactions.reduce((n, t) => n + t.amountIn, 0);
  const totalOut = transactions.reduce((n, t) => n + t.amountOut, 0);

  // Same-day entries run in the order they were recorded (time, then entry number), so the running balance
  // reads like a bank statement. The newest entry is shown first.
  const ordered = [...transactions].sort((a, b) => (a.date.getTime() - b.date.getTime()) || (a.time ?? "").localeCompare(b.time ?? "") || a.entryNo - b.entryNo);
  const balances = runningBalances(ordered, opening);
  const rows = ordered.map((t, i) => {
    const cls = classifyCash(t);
    return {
      id: t.id,
      entryNo: t.entryNo,
      date: t.date.toISOString().slice(0, 10),
      time: t.time,
      category: t.category,
      party: t.party,
      mode: t.mode,
      remark: t.remark,
      projectLand: t.projectLand,
      amountIn: t.amountIn,
      amountOut: t.amountOut,
      balance: balances[i],
      enteredBy: t.enteredBy,
      editedBy: t.updatedById ? editorName.get(t.updatedById) ?? "a user" : null,
      editedAt: t.updatedAt ? t.updatedAt.toISOString() : null,
      cls,
      clsLabel: CLASS_LABEL[cls],
      manualClass: t.accountClass,
    };
  }).reverse();

  const modeHref = (m: ModeFilter) => {
    const q = new URLSearchParams({ period });
    if (period === "custom") { if (from) q.set("from", from); if (to) q.set("to", to); }
    if (m !== "ALL") q.set("mode", m);
    return `?${q.toString()}`;
  };

  const summary = (
    <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-neutral-200 rounded-xl divide-neutral-200 [&>*]:border-neutral-200 [&>*:nth-child(odd)]:border-r [&>*:nth-child(-n+2)]:border-b lg:[&>*]:border-b-0 lg:[&>*:not(:last-child)]:border-r">
      <SummaryBox label="Opening Balance" value={formatRs(opening)} tone="indigo" icon={<span className="block h-3 w-3 rounded-full border-2 border-current" />} />
      <SummaryBox label="Cash In" value={formatRs(totalIn)} tone="green" icon="+" />
      <SummaryBox label="Cash Out" value={formatRs(totalOut)} tone="red" icon="−" />
      <SummaryBox label="Net Balance" value={formatRs(opening + totalIn - totalOut)} tone="indigo" icon="=" />
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Cash Register</h1>
          <p className="text-sm text-neutral-500">Every cash and bank transaction, who recorded it and when.</p>
        </div>
        <div className="flex rounded-lg border border-neutral-200 bg-white overflow-hidden text-xs font-medium">
          {([["ALL", "All books"], ["CASH", "Petty cash"], ["BANK", "Bank"]] as const).map(([m, label]) => (
            <Link key={m} href={modeHref(m)} className={`px-3.5 py-2 ${mode === m ? "bg-green-700 text-white" : "text-neutral-600 hover:bg-neutral-50"}`}>
              {label}
            </Link>
          ))}
        </div>
      </div>
      <PeriodBar period={period} from={from} to={to} extraParams={mode === "ALL" ? undefined : { mode }} />

      <CashRegisterTable
        entries={rows}
        categories={categories}
        vendorNames={vendorNames}
        customerNames={customers.map((c) => c.name)}
        isAdmin={isAdmin}
        summary={summary}
      />
    </div>
  );
}
