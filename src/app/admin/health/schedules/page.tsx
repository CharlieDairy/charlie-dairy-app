import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import AddScheduleForm from "./AddScheduleForm";
import ScheduleActiveToggle from "./ScheduleActiveToggle";
import DeleteRowButton from "@/components/DeleteRowButton";
import { deleteHealthSchedule } from "./actions";

const TYPE_LABELS: Record<string, string> = {
  VACCINATION: "Vaccination",
  DEWORMING: "Deworming",
  CHECKUP: "Checkup",
};

function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}

export default async function HealthSchedulesPage() {
  const [schedules, session] = await Promise.all([
    prisma.healthSchedule.findMany({ orderBy: { createdAt: "desc" } }),
    auth(),
  ]);
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Health Schedules</h1>
        <p className="text-sm text-neutral-500 max-w-2xl">
          Define recurring vaccination, deworming and checkup schedules for the herd.
        </p>
      </div>

      <AddScheduleForm />

      <div className="bg-white border border-neutral-200 rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Repeat Every</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id} className="border-t border-neutral-100">
                <td className="px-3 py-2 font-medium">{s.name}</td>
                <td className="px-3 py-2">{TYPE_LABELS[s.type] ?? s.type}</td>
                <td className="px-3 py-2">{s.intervalDays} days</td>
                <td className="px-3 py-2">
                  <span className={s.active ? "text-green-700" : "text-neutral-400"}>{s.active ? "Active" : "Paused"}</span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <ScheduleActiveToggle id={s.id} active={s.active} />
                    {isAdmin && (
                      <DeleteRowButton
                        action={deleteHealthSchedule}
                        hiddenFields={{ id: s.id }}
                        confirmMessage={`Delete the "${s.name}" schedule? This can't be undone.`}
                        icon={<IconTrash />}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {schedules.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-neutral-400">
                  No health schedules yet — create one above to track vaccinations, deworming and checkups.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
