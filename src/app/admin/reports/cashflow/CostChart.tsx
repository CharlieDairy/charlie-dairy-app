"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CostPoint } from "@/lib/reports/cashFlowDetail";

const fmt = (n: number) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;
const compact = (n: number) => (Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : Math.abs(n) >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

const SERIES: { key: keyof Omit<CostPoint, "label">; name: string; color: string }[] = [
  { key: "running", name: "Running costs", color: "#a97c1a" },
  { key: "capital", name: "Capital spending", color: "#2f6f4e" },
  { key: "partners", name: "Paid to partners", color: "#8b8fa8" },
];

export default function CostChart({ data }: { data: CostPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e4" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#737373" }} axisLine={{ stroke: "#e5e5e4" }} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 12, fill: "#737373" }} axisLine={false} tickLine={false} width={52} tickFormatter={compact} />
          <Tooltip
            formatter={(value, name) => [fmt(Number(value)), String(name)]}
            labelFormatter={(label) => String(label)}
            contentStyle={{ borderRadius: 8, borderColor: "#e5e5e4", fontSize: 13 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {SERIES.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} stackId="cost" fill={s.color} radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
