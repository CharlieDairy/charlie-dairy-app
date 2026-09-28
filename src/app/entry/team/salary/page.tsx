import { prisma } from "@/lib/prisma";
import SalaryPaymentForm from "./SalaryPaymentForm";

export default async function SalaryPaymentEntryPage() {
  const employees = await prisma.employee.findMany({
    where: { active: true },
    select: { id: true, name: true, monthlySalary: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900">Salary Payment</h1>
      <SalaryPaymentForm employees={employees} />
    </div>
  );
}
