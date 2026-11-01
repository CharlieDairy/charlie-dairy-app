import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getLiveUser } from "@/lib/access";
import { ENTITY_LABEL, type DeletableEntity } from "@/lib/deletionApproval";
import ApprovalButtons from "./ApprovalButtons";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" }).format(d);
const label = (entity: string) => ENTITY_LABEL[entity as DeletableEntity] ?? entity;

export default async function DeleteApprovalsPage() {
  const user = await getLiveUser();
  if (user?.role !== "ADMIN") redirect("/admin");

  const [pending, decided] = await Promise.all([
    prisma.deletionRequest.findMany({ where: { status: "PENDING" }, orderBy: { requestedAt: "asc" } }),
    prisma.deletionRequest.findMany({ where: { status: { not: "PENDING" } }, orderBy: { decidedAt: "desc" }, take: 30 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Delete approvals</h1>
        <p className="text-sm text-neutral-500">
          The farm manager can edit any transaction, but a delete only goes through when you approve it here. Nothing is removed until then. Your own deletes happen straight away.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">
          Waiting for you <span className={`ml-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${pending.length > 0 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>{pending.length}</span>
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-neutral-200 bg-white px-4 py-6 text-sm text-neutral-500">No delete requests are waiting.</p>
        ) : (
          <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="px-4 py-2 text-left">Asked</th>
                  <th className="px-4 py-2 text-left">By</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">What it is</th>
                  <th className="px-4 py-2 text-left">Decide</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-100 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">{fmt(r.requestedAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.requestedBy}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium">{label(r.entity)}</td>
                    <td className="px-4 py-3 min-w-[260px]">{r.summary}</td>
                    <td className="px-4 py-3"><ApprovalButtons id={r.id} summary={r.summary} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">Recent decisions</h2>
        <div className="overflow-x-auto bg-white border border-neutral-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-100">
              <tr>
                <th className="px-4 py-2 text-left">Decided</th>
                <th className="px-4 py-2 text-left">Result</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">What it was</th>
                <th className="px-4 py-2 text-left">Asked by</th>
                <th className="px-4 py-2 text-left">Note</th>
              </tr>
            </thead>
            <tbody>
              {decided.map((r) => (
                <tr key={r.id} className="border-t border-neutral-100 align-top">
                  <td className="px-4 py-2 whitespace-nowrap">{r.decidedAt ? fmt(r.decidedAt) : ""}<div className="text-xs text-neutral-400">{r.decidedBy}</div></td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.status === "APPROVED" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                      {r.status === "APPROVED" ? "Deleted" : "Kept"}
                    </span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{label(r.entity)}</td>
                  <td className="px-4 py-2 min-w-[240px]">{r.summary}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{r.requestedBy}</td>
                  <td className="px-4 py-2 text-neutral-500">{r.decisionNote ?? ""}</td>
                </tr>
              ))}
              {decided.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-neutral-400">No decisions yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-neutral-500">The Audit Log also records every request, approval and rejection.</p>
      </section>
    </div>
  );
}
