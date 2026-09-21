"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ProductionVsSoldPoint } from "@/lib/reports/milkAnalytics";

export default function ProductionVsSoldChart({ data }: { data: ProductionVsSoldPoint[] }) {
  // Stacked bars are drawn as Sold + Unaccounted; clamp negative unaccounted
  // (a month where recorded sales exceed recorded production) to 0 for the
  // stack so it doesn't render below the axis, but the real number is still
  // shown in the tooltip.
  const chartData = data.map((d) => ({ ...d, unaccountedDisplay: Math.max(d.unaccounted, 0) }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e4" />
          <XAxis dataKey="monthLabel" tick={{ fontSize: 12, fill: "#737373" }} axisLine={{ stroke: "#e5e5e4" }} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#737373" }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            formatter={(value, name) => [`${Number(value).toLocaleString()} L`, name === "unaccountedDisplay" ? "Unaccounted" : "Sold"]}
            contentStyle={{ borderRadius: 8, borderColor: "#e5e5e4", fontSize: 13 }}
          />
          <Legend
            formatter={(value) => (value === "unaccountedDisplay" ? "Unaccounted / not yet recorded" : "Recorded Sales")}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="sold" stackId="a" fill="#15803d" radius={[0, 0, 0, 0]} />
          <Bar dataKey="unaccountedDisplay" stackId="a" fill="#d4d4d4" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
