"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyMilkPoint } from "@/lib/reports/milkAnalytics";

export default function YearlyMilkChart({ data, bestMonth }: { data: MonthlyMilkPoint[]; bestMonth: string | null }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e4" />
          <XAxis dataKey="monthLabel" tick={{ fontSize: 12, fill: "#737373" }} axisLine={{ stroke: "#e5e5e4" }} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#737373" }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            formatter={(value) => [`${Number(value).toLocaleString()} L`, "Milk"]}
            contentStyle={{ borderRadius: 8, borderColor: "#e5e5e4", fontSize: 13 }}
          />
          <Bar dataKey="litres" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.month} fill={d.monthLabel === bestMonth ? "#15803d" : "#86efac"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
