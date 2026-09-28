import MilkUsageForm from "./MilkUsageForm";

export default function MilkUsageEntryPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900">Farm/Employee Use Entry</h1>
      <p className="text-sm text-neutral-500 max-w-md">
        Milk consumed on the farm (calves, household) or given to staff — recorded here so it counts against
        production before the remaining balance is sold, instead of showing up as an unexplained gap on Production
        Reconciliation.
      </p>
      <MilkUsageForm />
    </div>
  );
}
