import Link from "next/link";
import { notFound } from "next/navigation";
import { getCowProfile } from "@/lib/reports/cowProfile";
import { getLabelMap, labelFor } from "@/lib/masterData";
import { prisma } from "@/lib/prisma";
import CowEditForm from "../CowEditForm";
import WeightForm from "../WeightForm";
import MovementForm from "../MovementForm";
import LactationChart from "../LactationChart";
import WeightChart from "../WeightChart";

function fmtDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}

function ageFromDob(dob: Date | null): string {
  if (!dob) return "—";
  const ms = Date.now() - dob.getTime();
  const years = ms / (365.25 * 86_400_000);
  if (years < 1) return `${Math.floor(years * 12)} months`;
  return `${years.toFixed(1)} years`;
}

export default async function CowProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCowProfile(id);
  if (!profile) notFound();
  const { cow, milking, lactationSeries } = profile;

  const [statusLabels, genderLabels, locationRows] = await Promise.all([
    getLabelMap("COW_STATUS"),
    getLabelMap("COW_GENDER"),
    prisma.cowMovement.findMany({ select: { location: true }, distinct: ["location"], orderBy: { location: "asc" } }),
  ]);
  const locations = locationRows.map((r) => r.location);
  const currentLocation = cow.movements[0]?.location ?? null;

  const allCalves = cow.calvingsAsDam.flatMap((c) => c.calves.map((calf) => ({ calf, calving: c })));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {cow.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cow.photoUrl} alt={`Cow ${cow.tag}`} className="w-16 h-16 object-cover rounded-md border border-neutral-200" />
          )}
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Cow {cow.tag}</h1>
            <p className="text-sm text-neutral-500">
              {labelFor(genderLabels, cow.gender)} · {labelFor(statusLabels, cow.status)}
              {currentLocation && <> · {currentLocation}</>}
            </p>
          </div>
        </div>
        <Link href="/admin/cows" className="text-sm text-neutral-500 underline">
          ← Back to Cow Register
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
          {cow.calfRecord.birthWeight && <span className="text-neutral-500"> · birth weight {cow.calfRecord.birthWeight} kg</span>}
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-neutral-900">Overview</h2>
          <CowEditForm
            cowId={cow.id}
            condition={cow.condition}
            purchasePrice={cow.purchasePrice}
            source={cow.source}
            notes={cow.notes}
            photoUrl={cow.photoUrl}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mt-2">
          <div><span className="text-neutral-500">Condition:</span> {cow.condition ?? "—"}</div>
          <div><span className="text-neutral-500">Last Calving:</span> {fmtDate(cow.lastCalvingDate)}</div>
          <div><span className="text-neutral-500">Expected Calving:</span> {fmtDate(cow.expectedCalving)}</div>
          <div><span className="text-neutral-500">Dry-Off Due:</span> {fmtDate(cow.dryDate)}</div>
          <div><span className="text-neutral-500">Next AI Due:</span> {fmtDate(cow.nextAiDate)}</div>
          <div><span className="text-neutral-500">Target Sell Date:</span> {fmtDate(cow.targetSellDate)}</div>
          <div><span className="text-neutral-500">Purchase Price:</span> {cow.purchasePrice ? `Rs ${cow.purchasePrice.toLocaleString()}` : "—"}</div>
          <div><span className="text-neutral-500">Source:</span> {cow.source ?? "—"}</div>
        </div>
        {cow.notes && <p className="text-sm text-neutral-600 mt-3 border-t border-neutral-100 pt-3">{cow.notes}</p>}
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
        <h2 className="font-semibold text-neutral-900 mb-1">Milking Summary</h2>
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
          <p className="text-xs font-medium text-neutral-500 uppercase mb-2">Lactation Curve</p>
          <LactationChart data={lactationSeries} />
        </div>
        {milking.recent.length > 0 && (
          <table className="w-full text-sm mt-3">
            <thead>
              <tr className="text-xs text-neutral-500 border-t border-neutral-100">
                <th className="text-left py-1 font-normal">Date</th>
                <th className="text-left py-1 font-normal">Shift</th>
                <th className="text-right py-1 font-normal">Litres</th>
              </tr>
            </thead>
            <tbody>
              {milking.recent.map((m) => (
                <tr key={m.id} className="border-t border-neutral-100">
                  <td className="py-1">{fmtDate(m.date)}</td>
                  <td className="py-1">{m.shift}</td>
                  <td className="py-1 text-right">{m.litres}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {milking.recordCount > 10 && (
          <p className="text-xs text-neutral-400 mt-2">Showing the 10 most recent entries of {milking.recordCount} total.</p>
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
                {cow.heatEvents.map((h) => <li key={h.id}>{fmtDate(h.detectedAt)} — {h.detectionMethod}</li>)}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase mb-1">Inseminations</p>
            {cow.inseminations.length === 0 ? <p className="text-neutral-400">None</p> : (
              <ul className="space-y-1">
                {cow.inseminations.map((i) => <li key={i.id}>{fmtDate(i.date)} — #{i.serviceNumber} ({i.method})</li>)}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase mb-1">Pregnancy Checks</p>
            {cow.pregnancyChecks.length === 0 ? <p className="text-neutral-400">None</p> : (
              <ul className="space-y-1">
                {cow.pregnancyChecks.map((p) => <li key={p.id}>{fmtDate(p.date)} — {p.result}</li>)}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
