"use client";

import Link from "next/link";
import StatusSelect from "./StatusSelect";
import DeleteCowButton from "./DeleteCowButton";

export type AnimalRow = {
  id: string;
  tag: string;
  breed: string | null;
  gender: string;
  status: string;
  photoUrl: string | null;
  dateOfBirth: string | null;
  latestWeightKg: number | null;
  pregnant: boolean;
  monthsInStatus: number | null;
};

function ageFromDob(dobIso: string | null): string {
  if (!dobIso) return "—";
  const ms = Date.now() - new Date(dobIso).getTime();
  const years = ms / (365.25 * 86_400_000);
  if (years < 1) return `${Math.floor(years * 12)} months`;
  return `${years.toFixed(1)} years`;
}

export default function AnimalCard({
  animal,
  statusOptions,
  selectable = false,
  selected = false,
  onToggleSelect,
}: {
  animal: AnimalRow;
  statusOptions: { code: string; label: string }[];
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-3 flex gap-3">
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect?.(animal.id)}
          aria-label={`Select ${animal.tag}`}
          className="mt-1 shrink-0"
        />
      )}
      {animal.photoUrl ? (
        <Link
          href={`/admin/cows/${animal.id}?edit=1`}
          title="Edit"
          className="w-16 h-16 rounded-md border border-neutral-200 bg-neutral-50 shrink-0 overflow-hidden flex items-center justify-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={animal.photoUrl} alt={`Cow ${animal.tag}`} className="w-full h-full object-contain" />
        </Link>
      ) : (
        <Link
          href={`/admin/cows/${animal.id}?edit=1`}
          title="Edit"
          className="w-16 h-16 rounded-md bg-neutral-100 border border-neutral-200 shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link href={`/admin/cows/${animal.id}`} className="font-semibold text-primary hover:underline">
              {animal.tag}
            </Link>
            {animal.breed && <span className="text-xs text-neutral-500 ml-1">· {animal.breed}</span>}
            <div className="text-xs text-neutral-500 mt-0.5">
              {animal.latestWeightKg != null ? `${animal.latestWeightKg} kg` : "— kg"} · {ageFromDob(animal.dateOfBirth)}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Link href={`/admin/cows/${animal.id}`} title="View / Edit" className="text-xs rounded px-1.5 py-1 border border-border text-text hover:bg-neutral-100">
              ✎
            </Link>
            <DeleteCowButton cowId={animal.id} tag={animal.tag} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span className="text-xs rounded px-2 py-0.5 border border-neutral-200 text-neutral-600">{animal.gender}</span>
          <StatusSelect cowId={animal.id} status={animal.status} options={statusOptions} />
          {animal.pregnant && (
            <span className="text-xs rounded px-2 py-0.5 border border-info-light bg-info-light text-info">Pregnant</span>
          )}
          {animal.status === "MILKING" && animal.monthsInStatus !== null && (
            <span className="text-xs text-neutral-400">{animal.monthsInStatus}mo since calving</span>
          )}
        </div>
      </div>
    </div>
  );
}
