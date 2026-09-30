"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS: Record<string, string> = {
  Excellent: "#406d09",
  Good: "#a97c1a",
  Fair: "#ea9c3d",
  Poor: "#dc2626",
};

export default function ScoreDistributionChart({ data }: { data: { category: string; count: number }[] }) {
  const chartData = data.filter((d) => d.count > 0);
  if (chartData.length === 0) return <p className="text-sm text-neutral-400">No active animals to score yet.</p>;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={chartData} dataKey="count" nameKey="category" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {chartData.map((d) => (
              <Cell key={d.category} fill={COLORS[d.category] ?? "#a3a3a3"} />
            ))}
          </Pie>
          <Tooltip formatter={(value, name) => [`${value} animals`, name]} contentStyle={{ borderRadius: 8, borderColor: "#e5e5e4", fontSize: 13 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
