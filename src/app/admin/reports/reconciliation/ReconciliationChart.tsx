"use client";

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import type { ReconciliationRow } from "@/lib/reports/reconciliation";

export default function ReconciliationChart({ rows }: { rows: ReconciliationRow[] }) {
  const data = [...rows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({
      date: r.date.slice(5),
      Produced: r.producedLitres,
      Used: r.calfUseLitres + r.farmUseLitres + r.employeeUseLitres,
      Sold: r.recordedSaleLitres,
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
          <Area name="Produced" dataKey="Produced" stroke="#0d9488" fill="#ccfbf1" connectNulls={false} />
          <Line name="Used (Calf/Farm/Employee)" dataKey="Used" stroke="#f59e0b" strokeDasharray="5 4" dot={false} connectNulls={false} />
          <Line name="Sold" dataKey="Sold" stroke="#0ea5e9" strokeDasharray="2 2" dot={false} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
