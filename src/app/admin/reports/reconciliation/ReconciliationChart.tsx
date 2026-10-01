"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import type { ReconciliationRow } from "@/lib/reports/reconciliation";

export default function ReconciliationChart({ rows }: { rows: ReconciliationRow[] }) {
  const data = [...rows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({
      date: r.date.slice(5),
      "Calf Use": r.calfUseLitres,
      "Farm Use": r.farmUseLitres,
      "Employee Use": r.employeeUseLitres,
      "Recorded Sale": r.recordedSaleLitres,
      Produced: r.producedLitres,
    }));

  return (
    <div className="h-64 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis width={45} tick={{ fontSize: 11 }} unit="L" />
          <Tooltip />
          <Legend />
          <Bar name="Calf Use" dataKey="Calf Use" stackId="disposition" fill="#f59e0b" />
          <Bar name="Farm Use" dataKey="Farm Use" stackId="disposition" fill="#8b5cf6" />
          <Bar name="Employee Use" dataKey="Employee Use" stackId="disposition" fill="#f43f5e" />
          <Bar name="Recorded Sale" dataKey="Recorded Sale" stackId="disposition" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
          <Line name="Produced (total)" dataKey="Produced" stroke="#0d9488" strokeWidth={2} dot={false} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
