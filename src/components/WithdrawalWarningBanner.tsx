import type { ActiveWithdrawal } from "@/lib/reports/withdrawal";

export default function WithdrawalWarningBanner({ withdrawals }: { withdrawals: ActiveWithdrawal[] }) {
  if (withdrawals.length === 0) return null;

  return (
    <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
      <p className="font-medium text-red-700">
        ⚠ {withdrawals.length} animal{withdrawals.length === 1 ? " is" : "s are"} in milk withdrawal — verify their milk was excluded from this sale.
      </p>
      <ul className="text-xs text-red-600 mt-1.5 space-y-0.5">
        {withdrawals.map((w) => (
          <li key={w.cowId}>
            Cow {w.cowTag} — {w.medicineName}, until {w.withdrawalUntil.toISOString().slice(0, 10)}
          </li>
        ))}
      </ul>
      <p className="text-xs text-red-500 mt-1.5">
        Milk sales aren&apos;t tracked per animal (batches are pooled), so this can&apos;t block a specific sale —
        it&apos;s a reminder to check before selling.
      </p>
    </div>
  );
}
