import Link from "next/link";
import { notFound } from "next/navigation";
import { getCowProfile } from "@/lib/reports/cowProfile";
import { getLabelMap, labelFor } from "@/lib/masterData";
import { prisma } from "@/lib/prisma";
import { resolvePeriod } from "@/lib/period";
import { getCowScore, type ScoreCategory } from "@/lib/reports/scoring";
import CowEditForm from "../CowEditForm";
import WeightForm from "../WeightForm";
import MovementForm from "../MovementForm";
import LactationChart from "../LactationChart";
import WeightChart from "../WeightChart";
import CowCustomFieldsForm from "../CowCustomFieldsForm";
import PeriodBar from "@/components/PeriodBar";
import RecordActions from "@/components/RecordActions";
import { getLiveUser, hasPermission } from "@/lib/access";
import {
  updateWeightRecord, deleteWeightRecord, updateVaccination, deleteVaccination, updateTreatment, deleteTreatment,
  updateHeatEvent, deleteHeatEvent, updateInsemination, deleteInsemination, updatePregnancyCheck, deletePregnancyCheck,
  updateCalving, deleteCalving,
} from "../recordActions";

// This page's Milking Summary reads the "period" search param on every
// request (day/week/month/year/all) -- force-dynamic guarantees a fresh
// server render (and fresh dailyBreakdown query) per selection instead of
// risking a cached render being reused across period changes.
export const dynamic = "force-dynamic";

const HEALTH_BADGE_CLASS: Record<ScoreCategory, string> = {
  Excellent: "bg-green-50 text-green-700",
  Good: "bg-amber-50 text-amber-700",
  Fair: "bg-orange-50 text-orange-700",
  Poor: "bg-red-50 text-red-700",
};

function fmtDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
const isoDT = (d: Date) => d.toISOString().slice(0, 16);
const opts = (values: string[]) => values.map((v) => ({ value: v, label: v.replace(/_/g, " ") }));
const HEAT_METHODS = opts(["VISUAL", "ACTIVITY_MONITOR", "TAIL_PAINT", "OTHER"]);
const AI_METHOD_OPTS = opts(["AI", "NATURAL", "EMBRYO_TRANSFER"]);
const PREG_METHOD_OPTS = opts(["PALPATION", "ULTRASOUND", "BLOOD_TEST", "OBSERVATION"]);
const PREG_RESULT_OPTS = opts(["PREGNANT", "OPEN", "INCONCLUSIVE"]);
const DIFFICULTY_OPTS = opts(["UNASSISTED", "EASY_PULL", "HARD_PULL", "VET_ASSISTED", "CAESAREAN"]);

function ageFromDob(dob: Date | null): string {
  if (!dob) return "—";
  const ms = Date.now() - dob.getTime();
  const years = ms / (365.25 * 86_400_000);
  if (years < 1) return `${Math.floor(years * 12)} months`;
  return `${years.toFixed(1)} years`;
}

export default async function CowProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; from?: string; to?: string; edit?: string }>;
}) {
  const { id } = await params;
  const live = await getLiveUser();
  const can = (m: "weight" | "health" | "breeding", a: "EDIT" | "DELETE") => !!live && hasPermission(live, m, a);
  const searchParamsResolved = await searchParams;
  const { edit } = searchParamsResolved;
  const { period, from, to } = await resolvePeriod(searchParamsResolved, "month");
  const profile = await getCowProfile(id, period, from, to);
  if (!profile) notFound();
  const { cow, milking, dailyBreakdown, customFields, health } = profile;

  const [statusLabels, genderLabels, locationRows, healthScore] = await Promise.all([
    getLabelMap("COW_STATUS"),
    getLabelMap("COW_GENDER"),
    prisma.cowMovement.findMany({ select: { location: true }, distinct: ["location"], orderBy: { location: "asc" } }),
    getCowScore(id),
  ]);
  const locations = locationRows.map((r) => r.location);
  const currentLocation = cow.movements[0]?.location ?? null;

  // Calving/calf breakdown for the Overview panel -- "kinds of calvings"
  // means difficulty (unassisted vs. needed help) and calf outcome, not
  // just the raw count already shown in the top stat strip.
  const allCalvesForSummary = cow.calvingsAsDam.flatMap((c) => c.calves);
  const assistedCalvings = cow.calvingsAsDam.filter((c) => c.difficulty !== "UNASSISTED").length;
  const liveCalves = allCalvesForSummary.filter((c) => c.outcome === "ALIVE").length;
  const lostCalves = allCalvesForSummary.length - liveCalves;
  const daysInMilk = cow.status === "MILKING" && cow.lastCalvingDate
    ? Math.floor((Date.now() - cow.lastCalvingDate.getTime()) / 86_400_000)
    : null;

  const allCalves = cow.calvingsAsDam.flatMap((c) => c.calves.map((calf) => ({ calf, calving: c })));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {cow.photoUrl && (
            <div className="w-16 h-16 rounded-md border border-neutral-200 bg-neutral-50 overflow-hidden flex items-center justify-center shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cow.photoUrl} alt={`Cow ${cow.tag}`} className="w-full h-full object-contain" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Cow {cow.tag}</h1>
            <p className="text-sm text-neutral-500">
              {cow.breed && <>{cow.breed} · </>}
              {labelFor(genderLabels, cow.gender)} · {labelFor(statusLabels, cow.status)}
              {currentLocation && <> · {currentLocation}</>}
            </p>
          </div>
        </div>
        <Link href="/admin/cows" className="link-btn">
          ← Back to Animals
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Date of Birth</div>
          <div className="text-lg font-semibold mt-1">{fmtDate(cow.dateOfBirth)}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Age</div>
          <div className="text-lg font-semibold mt-1">{ageFromDob(cow.dateOfBirth)}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Lactation #</div>
          <div className="text-lg font-semibold mt-1">{cow.lactationNumber}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Calvings on Record</div>
          <div className="text-lg font-semibold mt-1">{cow.calvingsAsDam.length}</div>
        </div>
      </div>

      {cow.calfRecord && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4 text-sm">
          <span className="text-neutral-500">Born </span>
          {fmtDate(cow.calfRecord.calving.date)}
          <span className="text-neutral-500"> to dam </span>
          <Link href={`/admin/cows/${cow.calfRecord.calving.dam.id}`} className="text-green-700 hover:underline font-medium">
            {cow.calfRecord.calving.dam.tag}
          </Link>
          {cow.calfRecord.calving.sireTag && <span className="text-neutral-500"> · sire </span>}
          {cow.calfRecord.calving.sireTag && <span className="font-medium">{cow.calfRecord.calving.sireTag}</span>}
          {cow.calfRecord.birthWeight && <span className="text-neutral-500"> · birth weight {cow.calfRecord.birthWeight} kg</span>}
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
          <h2 className="font-semibold text-neutral-900">Overview</h2>
          <CowEditForm
            cowId={cow.id}
            breed={cow.breed}
            condition={cow.condition}
            purchasePrice={cow.purchasePrice}
            purchaseDate={cow.purchaseDate ? cow.purchaseDate.toISOString().slice(0, 10) : null}
            source={cow.source}
            notes={cow.notes}
            photoUrl={cow.photoUrl}
            autoOpen={edit === "1"}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mt-2">
          <div><span className="text-neutral-500">Breed:</span> {cow.breed ?? "—"}</div>
          <div><span className="text-neutral-500">Condition:</span> {cow.condition ?? "—"}</div>
          <div><span className="text-neutral-500">Last Calving:</span> {fmtDate(cow.lastCalvingDate)}</div>
          <div><span className="text-neutral-500">Expected Calving:</span> {fmtDate(cow.expectedCalving)}</div>
          <div><span className="text-neutral-500">Dry-Off Due:</span> {fmtDate(cow.dryDate)}</div>
          <div><span className="text-neutral-500">Next AI Due:</span> {fmtDate(cow.nextAiDate)}</div>
          <div><span className="text-neutral-500">Target Sell Date:</span> {fmtDate(cow.targetSellDate)}</div>
          <div><span className="text-neutral-500">Purchase Price:</span> {cow.purchasePrice ? `Rs ${cow.purchasePrice.toLocaleString()}` : "—"}</div>
          <div><span className="text-neutral-500">Purchase Date:</span> {fmtDate(cow.purchaseDate)}</div>
          <div><span className="text-neutral-500">Source:</span> {cow.source ?? "—"}</div>
        </div>
        {cow.notes && <p className="text-sm text-neutral-600 mt-3 border-t border-neutral-100 pt-3">{cow.notes}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mt-3 border-t border-neutral-100 pt-3">
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase mb-1">Calvings</p>
            <p>
              {cow.calvingsAsDam.length} calving{cow.calvingsAsDam.length === 1 ? "" : "s"} ·{" "}
              {allCalvesForSummary.length} {allCalvesForSummary.length === 1 ? "calf" : "calves"}
            </p>
            <p className="text-neutral-500">
              {liveCalves} alive{lostCalves > 0 ? `, ${lostCalves} lost` : ""} · {assistedCalvings} assisted
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase mb-1">Productivity</p>
            <p>{milking.totalLitres.toLocaleString()} L lifetime · {milking.avgPerDay.toFixed(1)} L/day avg</p>
            <p className="text-neutral-500">{daysInMilk != null ? `${daysInMilk} days in milk` : "Not currently milking"}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-medium text-neutral-500 uppercase">Health</p>
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${HEALTH_BADGE_CLASS[healthScore.category]}`}>
                {healthScore.score}/100 · {healthScore.category}
              </span>
            </div>
            <p>
              {health.vaccinationCount} vaccination{health.vaccinationCount === 1 ? "" : "s"} ·{" "}
              {health.treatmentCount} treatment{health.treatmentCount === 1 ? "" : "s"}
            </p>
            <p className="text-neutral-500">
              {health.nextVaccinationDue
                ? `Next: ${health.nextVaccinationDue.vaccineName} (${fmtDate(health.nextVaccinationDue.dueDate)})`
                : "No vaccination due date on record"}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <h2 className="font-semibold text-neutral-900 mb-1">Weight</h2>
        <WeightChart data={cow.weightRecords.map((w) => ({ date: fmtDate(w.date), weightKg: w.weightKg }))} />
        {cow.weightRecords.length === 0 && <p className="text-sm text-neutral-400 mb-2">No weight recorded yet.</p>}
        {cow.weightRecords.length > 0 && (
          <p className="text-sm text-neutral-600 mb-3">
            Latest: <span className="font-medium">{cow.weightRecords[cow.weightRecords.length - 1].weightKg} kg</span> on{" "}
            {fmtDate(cow.weightRecords[cow.weightRecords.length - 1].date)}
          </p>
        )}
        {cow.weightRecords.length > 0 && (
          <div className="mb-3 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {[...cow.weightRecords].reverse().slice(0, 12).map((w) => (
                  <tr key={w.id} className="border-t border-neutral-100">
                    <td className="py-1">{fmtDate(w.date)}</td>
                    <td className="py-1">{w.weightKg} kg</td>
                    <td className="py-1 text-right">
                      <RecordActions
                        id={w.id}
                        title={`Weight ${fmtDate(w.date)}`}
                        canEdit={can("weight", "EDIT")}
                        canDelete={can("weight", "DELETE")}
                        updateAction={updateWeightRecord}
                        deleteAction={deleteWeightRecord}
                        deleteConfirm={`Delete the ${w.weightKg} kg weight on ${fmtDate(w.date)}?`}
                        fields={[
                          { name: "date", label: "Date", type: "date", value: iso(w.date), required: true },
                          { name: "weightKg", label: "Weight (kg)", type: "number", step: "0.1", value: String(w.weightKg), required: true },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-neutral-100 pt-3">
          <WeightForm cowId={cow.id} />
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <h2 className="font-semibold text-neutral-900 mb-1">Location</h2>
        <p className="text-sm text-neutral-600 mb-3">
          Current: <span className="font-medium">{currentLocation ?? "Not recorded"}</span>
        </p>
        {cow.movements.length > 0 && (
          <table className="w-full text-sm mb-3">
            <thead>
              <tr className="text-xs text-neutral-500">
                <th className="text-left py-1 font-normal">Date</th>
                <th className="text-left py-1 font-normal">Location</th>
                <th className="text-left py-1 font-normal">Notes</th>
              </tr>
            </thead>
            <tbody>
              {cow.movements.map((m) => (
                <tr key={m.id} className="border-t border-neutral-100">
                  <td className="py-1">{fmtDate(m.date)}</td>
                  <td className="py-1">{m.location}</td>
                  <td className="py-1 text-neutral-500">{m.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="border-t border-neutral-100 pt-3">
          <MovementForm cowId={cow.id} locations={locations} />
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-neutral-900">Custom Fields</h2>
          <Link href="/admin/cows/custom-fields" className="link-btn">
            Manage Fields
          </Link>
        </div>
        <CowCustomFieldsForm cowId={cow.id} fields={customFields} />
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-neutral-900">Health</h2>
          <div className="flex items-center gap-3">
            <Link href="/entry/health/vaccination" className="link-btn link-btn-primary">+ Vaccination</Link>
            <Link href="/entry/health/treatment" className="link-btn link-btn-primary">+ Treatment</Link>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase mb-2">Vaccinations</p>
            {cow.vaccinations.length === 0 ? (
              <p className="text-sm text-neutral-400">None recorded.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {cow.vaccinations.map((v) => (
                    <tr key={v.id} className="border-t border-neutral-100">
                      <td className="py-1">{fmtDate(v.date)}</td>
                      <td className="py-1">{v.vaccineName}</td>
                      <td className="py-1 text-neutral-500">{v.nextDueDate ? `Next: ${fmtDate(v.nextDueDate)}` : ""}</td>
                      <td className="py-1 text-right">
                        <RecordActions
                          id={v.id}
                          title={`${v.vaccineName} ${fmtDate(v.date)}`}
                          canEdit={can("health", "EDIT")}
                          canDelete={can("health", "DELETE")}
                          updateAction={updateVaccination}
                          deleteAction={deleteVaccination}
                          deleteConfirm={`Delete the ${v.vaccineName} vaccination on ${fmtDate(v.date)}?`}
                          fields={[
                            { name: "date", label: "Date", type: "date", value: iso(v.date), required: true },
                            { name: "vaccineName", label: "Vaccine", value: v.vaccineName, required: true },
                            { name: "nextDueDate", label: "Next due date", type: "date", value: iso(v.nextDueDate) },
                            { name: "cost", label: "Cost", type: "number", step: "1", value: v.cost == null ? "" : String(v.cost) },
                            { name: "administeredBy", label: "Administered by", value: v.administeredBy ?? "" },
                            { name: "notes", label: "Notes", type: "textarea", value: v.notes ?? "" },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase mb-2">Treatments</p>
            {cow.treatments.length === 0 ? (
              <p className="text-sm text-neutral-400">None recorded.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {cow.treatments.map((t) => (
                    <tr key={t.id} className="border-t border-neutral-100">
                      <td className="py-1">{fmtDate(t.date)}</td>
                      <td className="py-1">{t.medicineName}</td>
                      <td className="py-1 text-neutral-500">{t.reason ?? ""}</td>
                      <td className="py-1 text-right">
                        <RecordActions
                          id={t.id}
                          title={`${t.medicineName} ${fmtDate(t.date)}`}
                          canEdit={can("health", "EDIT")}
                          canDelete={can("health", "DELETE")}
                          updateAction={updateTreatment}
                          deleteAction={deleteTreatment}
                          deleteConfirm={`Delete the ${t.medicineName} treatment on ${fmtDate(t.date)}? Its medicine stock use is removed too.`}
                          fields={[
                            { name: "date", label: "Date", type: "date", value: iso(t.date), required: true },
                            { name: "medicineName", label: "Medicine", value: t.medicineName, required: true },
                            { name: "dosage", label: "Dosage", value: t.dosage ?? "" },
                            { name: "quantityUsed", label: "Quantity used", type: "number", step: "0.1", value: t.quantityUsed == null ? "" : String(t.quantityUsed) },
                            { name: "reason", label: "Reason", value: t.reason ?? "" },
                            { name: "cost", label: "Cost", type: "number", step: "1", value: t.cost == null ? "" : String(t.cost) },
                            { name: "administeredBy", label: "Administered by", value: t.administeredBy ?? "" },
                            { name: "notes", label: "Notes", type: "textarea", value: t.notes ?? "" },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="flex flex-col gap-2 mb-1">
          <h2 className="font-semibold text-neutral-900">Milking Summary</h2>
          <PeriodBar period={period} from={from} to={to} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mt-2">
          <div><span className="text-neutral-500">Total Litres:</span> {milking.totalLitres.toLocaleString()} L</div>
          <div><span className="text-neutral-500">Days Recorded:</span> {milking.daysRecorded}</div>
          <div><span className="text-neutral-500">Avg / Day:</span> {milking.avgPerDay.toFixed(1)} L</div>
          <div><span className="text-neutral-500">Total Entries:</span> {milking.recordCount}</div>
          {milking.avgFatPct != null && (
            <div><span className="text-neutral-500">Avg Fat %:</span> {milking.avgFatPct.toFixed(1)}%</div>
          )}
          {milking.avgSnfPct != null && (
            <div><span className="text-neutral-500">Avg SNF %:</span> {milking.avgSnfPct.toFixed(1)}%</div>
          )}
        </div>
        <div className="mt-4">
          <p className="text-xs font-medium text-neutral-500 uppercase mb-2">Daily Yield by Shift</p>
          <LactationChart key={period} data={dailyBreakdown} />
        </div>
        {dailyBreakdown.length > 0 && (
          <div className="overflow-x-auto border border-neutral-200 rounded-lg mt-3">
            <table className="w-full text-sm text-center">
              <thead className="bg-neutral-100">
                <tr className="text-xs text-neutral-500">
                  <th className="py-2 px-3 font-medium">Date</th>
                  <th className="py-2 px-3 font-medium">Morning</th>
                  <th className="py-2 px-3 font-medium">Afternoon</th>
                  <th className="py-2 px-3 font-medium">Evening</th>
                  <th className="py-2 px-3 font-medium">Total</th>
                  <th className="py-2 px-3 font-medium">Daily Avg</th>
                </tr>
              </thead>
              <tbody>
                {[...dailyBreakdown].reverse().map((d) => (
                  <tr key={d.date} className="border-t border-neutral-100">
                    <td className="py-2 px-3">{d.date}</td>
                    <td className="py-2 px-3">{d.morning != null ? d.morning : "—"}</td>
                    <td className="py-2 px-3">{d.afternoon != null ? d.afternoon : "—"}</td>
                    <td className="py-2 px-3">{d.evening != null ? d.evening : "—"}</td>
                    <td className="py-2 px-3 font-medium">{d.total.toLocaleString()}</td>
                    <td className="py-2 px-3">{d.avgPerShift.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {dailyBreakdown.length === 0 && (
          <p className="text-sm text-neutral-400 mt-3">No milking entries recorded for this period.</p>
        )}
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <h2 className="font-semibold text-neutral-900 mb-1">Calving History</h2>
        {cow.calvingsAsDam.length === 0 ? (
          <p className="text-sm text-neutral-400">No calvings on record.</p>
        ) : (
          <table className="w-full text-sm mt-2">
            <thead>
              <tr className="text-xs text-neutral-500">
                <th className="text-left py-1 font-normal">Date</th>
                <th className="text-left py-1 font-normal">Sire</th>
                <th className="text-left py-1 font-normal">Gestation</th>
                <th className="text-left py-1 font-normal">Difficulty</th>
                <th className="text-left py-1 font-normal">Calves</th>
                <th className="py-1 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {cow.calvingsAsDam.map((c) => (
                <tr key={c.id} className="border-t border-neutral-100">
                  <td className="py-1">{fmtDate(c.date)}</td>
                  <td className="py-1">{c.sireTag ?? "—"}</td>
                  <td className="py-1">{c.gestationDays ? `${c.gestationDays} d` : "—"}</td>
                  <td className="py-1">{c.difficulty}</td>
                  <td className="py-1">{c.calfCount}</td>
                  <td className="py-1 text-right">
                    <RecordActions
                      id={c.id}
                      title={`Calving ${fmtDate(c.date)}`}
                      canEdit={can("breeding", "EDIT")}
                      canDelete={can("breeding", "DELETE")}
                      updateAction={updateCalving}
                      deleteAction={deleteCalving}
                      deleteConfirm={`Delete the calving on ${fmtDate(c.date)} and its calf records?`}
                      fields={[
                        { name: "sireTag", label: "Sire tag", value: c.sireTag ?? "" },
                        { name: "difficulty", label: "Difficulty", type: "select", options: DIFFICULTY_OPTS, value: c.difficulty, required: true },
                        { name: "assistedBy", label: "Assisted by", value: c.assistedBy ?? "" },
                        { name: "retainedPlacenta", label: "Retained placenta", type: "checkbox", value: c.retainedPlacenta },
                        { name: "complications", label: "Complications", type: "textarea", value: c.complications ?? "" },
                        { name: "notes", label: "Notes", type: "textarea", value: c.notes ?? "" },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <h2 className="font-semibold text-neutral-900 mb-1">Linked Children</h2>
        {allCalves.length === 0 ? (
          <p className="text-sm text-neutral-400">No calves on record for this dam.</p>
        ) : (
          <table className="w-full text-sm mt-2">
            <thead>
              <tr className="text-xs text-neutral-500">
                <th className="text-left py-1 font-normal">Born</th>
                <th className="text-left py-1 font-normal">Tag</th>
                <th className="text-left py-1 font-normal">Sex</th>
                <th className="text-left py-1 font-normal">Outcome</th>
                <th className="text-right py-1 font-normal">Birth Weight</th>
              </tr>
            </thead>
            <tbody>
              {allCalves.map(({ calf, calving }) => (
                <tr key={calf.id} className="border-t border-neutral-100">
                  <td className="py-1">{fmtDate(calving.date)}</td>
                  <td className="py-1">
                    {calf.cowId ? (
                      <Link href={`/admin/cows/${calf.cowId}`} className="text-green-700 hover:underline font-medium">
                        {calf.tag ?? "(view)"}
                      </Link>
                    ) : (
                      calf.tag ?? "— (not registered)"
                    )}
                  </td>
                  <td className="py-1">{calf.sex}</td>
                  <td className="py-1">{calf.outcome}</td>
                  <td className="py-1 text-right">{calf.birthWeight ? `${calf.birthWeight} kg` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <h2 className="font-semibold text-neutral-900 mb-1">Breeding History</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 text-sm">
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase mb-1">Heat Events</p>
            {cow.heatEvents.length === 0 ? <p className="text-neutral-400">None</p> : (
              <ul className="space-y-1">
                {cow.heatEvents.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2">
                    <span>{fmtDate(h.detectedAt)} — {h.detectionMethod}</span>
                    <RecordActions
                      id={h.id}
                      title={`Heat ${fmtDate(h.detectedAt)}`}
                      canEdit={can("breeding", "EDIT")}
                      canDelete={can("breeding", "DELETE")}
                      updateAction={updateHeatEvent}
                      deleteAction={deleteHeatEvent}
                      deleteConfirm={`Delete the heat event on ${fmtDate(h.detectedAt)}?`}
                      fields={[
                        { name: "detectedAt", label: "Date / time", type: "datetime-local", value: isoDT(h.detectedAt), required: true },
                        { name: "detectionMethod", label: "Detection method", type: "select", options: HEAT_METHODS, value: h.detectionMethod, required: true },
                        { name: "intensity", label: "Intensity", value: h.intensity ?? "" },
                        { name: "notes", label: "Notes", type: "textarea", value: h.notes ?? "" },
                      ]}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase mb-1">Inseminations</p>
            {cow.inseminations.length === 0 ? <p className="text-neutral-400">None</p> : (
              <ul className="space-y-1">
                {cow.inseminations.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2">
                    <span>{fmtDate(i.date)} — #{i.serviceNumber} ({i.method})</span>
                    <RecordActions
                      id={i.id}
                      title={`Insemination ${fmtDate(i.date)}`}
                      canEdit={can("breeding", "EDIT")}
                      canDelete={can("breeding", "DELETE")}
                      updateAction={updateInsemination}
                      deleteAction={deleteInsemination}
                      deleteConfirm={`Delete the insemination on ${fmtDate(i.date)}?`}
                      fields={[
                        { name: "date", label: "Date", type: "date", value: iso(i.date), required: true },
                        { name: "method", label: "Method", type: "select", options: AI_METHOD_OPTS, value: i.method, required: true },
                        { name: "semenBatch", label: "Semen batch", value: i.semenBatch ?? "" },
                        { name: "bullTag", label: "Bull tag", value: i.bullTag ?? "" },
                        { name: "technician", label: "Technician", value: i.technician ?? "" },
                        { name: "cost", label: "Cost", type: "number", step: "1", value: i.cost == null ? "" : String(i.cost) },
                        { name: "notes", label: "Notes", type: "textarea", value: i.notes ?? "" },
                      ]}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase mb-1">Pregnancy Checks</p>
            {cow.pregnancyChecks.length === 0 ? <p className="text-neutral-400">None</p> : (
              <ul className="space-y-1">
                {cow.pregnancyChecks.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span>{fmtDate(p.date)} — {p.result}</span>
                    <RecordActions
                      id={p.id}
                      title={`Pregnancy check ${fmtDate(p.date)}`}
                      canEdit={can("breeding", "EDIT")}
                      canDelete={can("breeding", "DELETE")}
                      updateAction={updatePregnancyCheck}
                      deleteAction={deletePregnancyCheck}
                      deleteConfirm={`Delete the pregnancy check on ${fmtDate(p.date)}?`}
                      fields={[
                        { name: "date", label: "Date", type: "date", value: iso(p.date), required: true },
                        { name: "method", label: "Method", type: "select", options: PREG_METHOD_OPTS, value: p.method, required: true },
                        { name: "result", label: "Result", type: "select", options: PREG_RESULT_OPTS, value: p.result, required: true },
                        { name: "notes", label: "Notes", type: "textarea", value: p.notes ?? "" },
                      ]}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
