"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type LactationChartRow = {
  date: string;
  morning: number | null;
  afternoon: number | null;
  evening: number | null;
};

export default function LactationChart({ data }: { data: LactationChartRow[] }) {
  if (data.length === 0) return <p className="text-sm text-neutral-400">No milking entries recorded for this period.</p>;

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e4" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#737373" }}
            axisLine={{ stroke: "#e5e5e4" }}
            tickLine={false}
            minTickGap={20}
          />
          <YAxis tick={{ fontSize: 12, fill: "#737373" }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            formatter={(value, name) => [`${Number(value).toLocaleString()} L`, name]}
            contentStyle={{ borderRadius: 8, borderColor: "#e5e5e4", fontSize: 13 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="morning" name="Morning" stackId="shift" fill="#406d09" />
          <Bar dataKey="afternoon" name="Afternoon" stackId="shift" fill="#5e9128" />
          <Bar dataKey="evening" name="Evening" stackId="shift" fill="#a97c1a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
