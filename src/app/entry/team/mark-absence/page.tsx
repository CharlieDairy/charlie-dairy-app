import Link from "next/link";
import { prisma } from "@/lib/prisma";
import MarkAbsenceForm from "./MarkAbsenceForm";

export default async function MarkAbsencePage() {
  const employees = await prisma.employee.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900">Mark Absence</h1>
      <p className="text-sm text-neutral-500">
        Quickly flag one employee as absent, without opening the full daily attendance form.{" "}
        <Link href="/entry/team/attendance" className="link-btn">Mark the whole team instead</Link>
      </p>
      <MarkAbsenceForm employees={employees} />
    </div>
  );
}
