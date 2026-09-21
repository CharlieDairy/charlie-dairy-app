"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { HerdCompositionRow } from "@/lib/reports/milkAnalytics";

const COLORS: Record<string, string> = {
  MILKING: "#15803d",
  DRY: "#86efac",
  HEIFER: "#60a5fa",
  CALF: "#fbbf24",
  DORMANT: "#a3a3a3",
  SOLD: "#d4d4d4",
  DEAD: "#e5e5e4",
};

export default function HerdCompositionChart({ data }: { data: HerdCompositionRow[] }) {
  const chartData = data.filter((d) => d.count > 0 && d.status !== "SOLD" && d.status !== "DEAD");

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={chartData} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {chartData.map((d) => (
              <Cell key={d.status} fill={COLORS[d.status] ?? "#a3a3a3"} />
            ))}
          </Pie>
          <Tooltip formatter={(value, name) => [`${value} animals`, name]} contentStyle={{ borderRadius: 8, borderColor: "#e5e5e4", fontSize: 13 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
